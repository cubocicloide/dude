/**
 * Docker-based IaC runner.
 *
 * `dude iac *` shells out to terraform. Requiring the customer to install it at
 * a compatible version is a portability and reproducibility headache (Terraform
 * is version-sensitive against its state). Instead we run it inside a container
 * built from the scaffold's own `iac/runner/Dockerfile` — which the customer
 * owns and can edit (bump a version, add a tool); the image tag is a hash of
 * that file, so any edit transparently rebuilds on the next `dude iac` command.
 *
 * The whole design hangs off one fact: every tool invocation goes through
 * `run`/`capture` (see `./exec.js`). When the tool is one we containerize and
 * Docker + the Dockerfile are present, those helpers rewrite the invocation into
 * `docker run … <image> <tool> <args>`. Because the IaC commands use *relative*
 * paths (`-chdir=iac/terraform`, `-var-file=environments/<env>/…`), mounting the
 * working directory to `/work` makes them resolve identically in the container.
 *
 * Credentials are NOT copied into the image or an .env file: we mount the host
 * `~/.aws` read-only and pass `AWS_PROFILE`, so SSO and named profiles keep
 * working exactly as on the host (the cached SSO token lives under
 * `~/.aws/sso/cache`). `dude iac login` is the one command that must stay on the
 * host — it needs a browser for SSO — so it bypasses the runner.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'pathe'

/** The runner Dockerfile lives in the scaffold so the customer can edit it. */
const RUNNER_DOCKERFILE = path.join('iac', 'runner', 'Dockerfile')

/** Tools that run inside the container. `aws` is intentionally absent:
 *  `dude iac login` runs it on the host for SSO, and the other AWS-CLI calls
 *  (status, logs, destroy cleanup) run natively too. Terraform reaches AWS
 *  through its own SDK + the mounted creds. */
export const CONTAINERIZED = new Set(['terraform'])

/**
 * Locate the scaffold's runner Dockerfile by ascending from `cwd` (which is
 * either the project root or a sub-dir like `iac/terraform/bootstrap`). Returns
 * the absolute path, or '' when no scaffold Dockerfile is found.
 */
function findDockerfile(cwd: string): string {
  let dir = path.resolve(cwd)
  for (;;) {
    const candidate = path.join(dir, RUNNER_DOCKERFILE)
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return ''
    dir = parent
  }
}

/** Image tag derived from the Dockerfile contents — any edit invalidates it. */
function imageTag(dockerfile: string): string {
  const hash = createHash('sha256').update(readFileSync(dockerfile)).digest('hex').slice(0, 12)
  return `dude-iac-runner:${hash}`
}

let dockerChecked: boolean | undefined
const ensured = new Set<string>()

/** True when a usable Docker daemon is reachable. Cached for the process. */
export function dockerAvailable(): boolean {
  if (dockerChecked !== undefined) return dockerChecked
  const r = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    encoding: 'utf8',
  })
  dockerChecked = r.status === 0 && !!r.stdout.trim()
  return dockerChecked
}

/**
 * Whether to route containerized tools through Docker for work rooted at `cwd`.
 * We prefer Docker whenever it's available and the scaffold ships a runner
 * Dockerfile; `DUDE_IAC_RUNNER=host` forces native execution, and a missing
 * Dockerfile falls back to native too (older scaffolds keep working).
 */
export function useRunner(cwd: string): boolean {
  if (process.env.DUDE_IAC_RUNNER === 'host') return false
  return dockerAvailable() && !!findDockerfile(cwd)
}

/** Build the runner image if it isn't present yet (once per tag per process). */
function ensureImage(dockerfile: string, tag: string): void {
  if (ensured.has(tag)) return
  const exists = spawnSync('docker', ['image', 'inspect', tag], { stdio: 'ignore' }).status === 0
  if (!exists) {
    process.stderr.write(
      `\n  →  Building the IaC runner image (${tag}). First run only — a minute or two…\n\n`,
    )
    const build = spawnSync(
      'docker',
      ['build', '-t', tag, '-f', dockerfile, path.dirname(dockerfile)],
      { stdio: 'inherit' },
    )
    if (build.status !== 0) {
      process.stderr.write('\n  ✗  Failed to build the IaC runner image.\n\n')
      process.exit(build.status ?? 1)
    }
  }
  ensured.add(tag)
}

/** Common `docker run` flags: mount the cwd as /work and the host AWS dir RO. */
function baseDockerArgs(cwd: string, profile: string | undefined, tty: boolean): string[] {
  const args = ['run', '--rm', tty ? '-it' : '-i']

  // The working directory becomes /work; relative tool paths resolve against it.
  args.push('-v', `${cwd}:/work`, '-w', '/work')

  // Mount the host AWS config + SSO cache read-only so profiles/SSO keep working.
  const home = os.homedir()
  args.push('-v', `${path.join(home, '.aws')}:/root/.aws:ro`)

  if (profile) args.push('-e', `AWS_PROFILE=${profile}`)
  return args
}

/**
 * Wrap a containerized tool invocation into a full `docker run …` argv. Builds
 * the image first when needed.
 */
export function dockerRunArgs(
  cmd: string,
  toolArgs: string[],
  cwd: string,
  profile: string | undefined,
  opts: { tty?: boolean } = {},
): string[] {
  const dockerfile = findDockerfile(cwd)
  const tag = imageTag(dockerfile)
  ensureImage(dockerfile, tag)
  const base = baseDockerArgs(cwd, profile, !!opts.tty)
  return [...base, tag, cmd, ...toolArgs]
}

/**
 * Build the `docker run …` argv for an interactive shell inside the runner
 * (terraform + the AWS CLI available, project mounted at /work).
 */
export function dockerShellArgs(projectRoot: string, profile: string | undefined): string[] {
  const dockerfile = findDockerfile(projectRoot)
  const tag = imageTag(dockerfile)
  ensureImage(dockerfile, tag)
  const base = baseDockerArgs(projectRoot, profile, true)
  return [...base, tag, 'bash']
}

/** True when the scaffold ships a runner Dockerfile reachable from `cwd`. */
export function hasRunnerDockerfile(cwd: string): boolean {
  return !!findDockerfile(cwd)
}
