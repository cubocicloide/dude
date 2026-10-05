/**
 * Docker-based IaC runner — Azure flavour.
 *
 * Same design as the AWS runner: `dude iac *` shells out to terraform / kubectl /
 * helm / k9s, and rather than making the customer install and version-match all
 * of them, we run those tools inside a container built from the scaffold's own
 * `iac/runner/Dockerfile` — which the customer owns and can edit. The image tag
 * is a hash of that file, so any edit transparently rebuilds on the next command.
 *
 * Everything hangs off one fact: every tool invocation goes through
 * `run`/`capture` (see `./exec.js`). When the tool is one we containerize and
 * Docker + the Dockerfile are present, those helpers rewrite the invocation into
 * `docker run … <image> <tool> <args>`. Because the IaC commands use *relative*
 * paths (`-chdir=iac/terraform`, `-var-file=environments/<env>/…`), mounting the
 * working directory to `/work` makes them resolve identically in the container.
 *
 * Credentials are NOT copied into the image: we mount the host `~/.azure` and
 * pass `ARM_SUBSCRIPTION_ID`, so `az login` on the host carries into every
 * container run. Unlike the AWS mount this one is read-WRITE on purpose — the
 * Azure CLI refreshes its MSAL access tokens in place, and a read-only
 * `~/.azure` makes every long session fail with an opaque token error once the
 * cached token expires. `dude iac login` itself stays on the host (it needs a
 * browser).
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'pathe'

/** The runner Dockerfile lives in the scaffold so the customer can edit it. */
const RUNNER_DOCKERFILE = path.join('iac', 'runner', 'Dockerfile')

/** Tools that run inside the container. `az` is intentionally absent: `dude iac
 *  login` needs a host browser for the device/interactive flow, and the other
 *  `az` calls (kubeconfig, ACR login, destroy cleanup) must agree with it about
 *  which account is signed in. Terraform reaches Azure through its own SDK plus
 *  the mounted credentials. */
export const CONTAINERIZED = new Set(['terraform', 'kubectl', 'helm', 'k9s'])

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
  return `dude-iac-runner-azure:${hash}`
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
 * Dockerfile falls back to native too.
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

/** Common `docker run` flags: mount the cwd as /work and the host Azure dir in. */
function baseDockerArgs(cwd: string, subscription: string | undefined, tty: boolean): string[] {
  const args = ['run', '--rm', tty ? '-it' : '-i']

  // The working directory becomes /work; relative tool paths resolve against it.
  args.push('-v', `${cwd}:/work`, '-w', '/work')

  // Mount the host Azure CLI profile + token cache. Read-write: the CLI rewrites
  // its MSAL cache when it refreshes an access token, and cannot authenticate at
  // all once the cached token has expired if the directory is read-only.
  const home = os.homedir()
  const azure = path.join(home, '.azure')
  if (existsSync(azure)) args.push('-v', `${azure}:/root/.azure`)

  // Bridge the host kubeconfig in (read-only) so kubectl/helm/k9s in the
  // container can fall back to the context `dude iac kubeconfig` wired on the
  // host when the in-container lookup can't reach the cluster.
  const kube = path.join(home, '.kube')
  if (existsSync(kube)) args.push('-v', `${kube}:/root/.kube:ro`)

  if (subscription) {
    args.push('-e', `ARM_SUBSCRIPTION_ID=${subscription}`)
    args.push('-e', `AZURE_SUBSCRIPTION_ID=${subscription}`)
  }
  return args
}

/** The cluster a kube tool (kubectl/helm/k9s) should target inside the runner. */
export interface KubeTarget {
  cluster: string
  resourceGroup: string
  namespace: string
}

/** Single-quote a value for safe interpolation into a bash command. */
function shq(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Bash lines that build a *dedicated* kubeconfig for the target cluster (via
 * `az aks get-credentials` against the mounted credentials) and select its
 * namespace — so a containerized kube tool targets exactly the env's cluster
 * rather than silently inheriting the host's current-context (which may point at
 * a different cluster). On failure (cluster not provisioned, bad credentials) it
 * unsets KUBECONFIG and falls back to the mounted ~/.kube. `verbose` prints a
 * friendly banner for the interactive shell; one-shot commands stay quiet on
 * stdout (so `capture` output isn't polluted) and only warn on stderr.
 */
function kubeSetupLines(t: KubeTarget, verbose: boolean): string[] {
  const lines = [
    'export KUBECONFIG=/tmp/dude-kubeconfig',
    `if az aks get-credentials --resource-group ${shq(t.resourceGroup)} --name ${shq(t.cluster)} --file "$KUBECONFIG" --overwrite-existing >/dev/null 2>&1; then`,
    `  kubectl config set-context --current --namespace=${shq(t.namespace)} >/dev/null 2>&1`,
  ]
  if (verbose) lines.push(`  echo "  ✓  context → ${t.cluster}   namespace → ${t.namespace}"; echo`)
  lines.push('else', '  unset KUBECONFIG')
  lines.push(
    verbose
      ? `  echo "  ⚠  couldn't reach cluster ${t.cluster} — using your mounted ~/.kube as-is."; echo`
      : `  echo "dude: couldn't target cluster ${t.cluster}; using the mounted kubeconfig as-is." >&2`,
  )
  lines.push('fi')
  return lines
}

/**
 * Wrap a containerized tool invocation into a full `docker run …` argv. Builds
 * the image first when needed. When `opts.kube` is supplied (only for kube
 * tools), the tool runs behind a prelude that pins the kubeconfig to that
 * cluster + namespace; otherwise it's invoked directly.
 */
export function dockerRunArgs(
  cmd: string,
  toolArgs: string[],
  cwd: string,
  subscription: string | undefined,
  opts: { tty?: boolean; kube?: KubeTarget } = {},
): string[] {
  const dockerfile = findDockerfile(cwd)
  const tag = imageTag(dockerfile)
  ensureImage(dockerfile, tag)
  const base = baseDockerArgs(cwd, subscription, !!opts.tty)
  if (opts.kube?.cluster && opts.kube?.resourceGroup) {
    // `bash -c <script> bash <toolArgs…>` → $0=bash, $@=toolArgs; the script
    // sets up the kubeconfig then `exec`s the real tool with those args.
    const script = [...kubeSetupLines(opts.kube, false), `exec ${cmd} "$@"`].join('\n')
    return [...base, tag, 'bash', '-c', script, 'bash', ...toolArgs]
  }
  return [...base, tag, cmd, ...toolArgs]
}

/**
 * Build the `docker run …` argv for an interactive shell inside the runner. When
 * `kube` (the env's cluster + resource group + namespace) is supplied, the shell
 * opens with kubectl/helm/k9s already pointed at that exact cluster and
 * namespace; otherwise it drops into a plain shell using the mounted ~/.kube.
 */
export function dockerShellArgs(
  projectRoot: string,
  subscription: string | undefined,
  kube?: KubeTarget,
): string[] {
  const dockerfile = findDockerfile(projectRoot)
  const tag = imageTag(dockerfile)
  ensureImage(dockerfile, tag)
  const base = baseDockerArgs(projectRoot, subscription, true)
  if (kube?.cluster && kube?.resourceGroup) {
    const script = [...kubeSetupLines(kube, true), 'exec bash'].join('\n')
    return [...base, tag, 'bash', '-c', script]
  }
  return [...base, tag, 'bash']
}

/** True when the scaffold ships a runner Dockerfile reachable from `cwd`. */
export function hasRunnerDockerfile(cwd: string): boolean {
  return !!findDockerfile(cwd)
}
