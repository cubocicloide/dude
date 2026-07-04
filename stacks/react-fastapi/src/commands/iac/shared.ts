/**
 * Generic helpers shared by every IaC provider. Nothing here is specific to a
 * cloud or tool (Terraform/Helm/AWS) — provider-specific helpers live under
 * `providers/<id>/lib/`.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'pathe'

function shouldUseShell(): boolean {
  return process.platform === 'win32'
}

/** Result of a captured (non-inherited) child process. */
export interface CaptureResult {
  status: number
  stdout: string
}

/**
 * Build the child process env. When a `profile` is given, AWS is scoped to it
 * via `AWS_PROFILE` so every spawned tool (terraform/aws/helm/kubectl) targets
 * the right account for the selected environment.
 */
export function childEnv(profile?: string): NodeJS.ProcessEnv {
  return profile ? { ...process.env, AWS_PROFILE: profile } : process.env
}

/** Run a command, inheriting stdio. Returns the exit status (or 1 on spawn error). */
export function run(cmd: string, args: string[], cwd: string, profile?: string): number {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: childEnv(profile),
    shell: shouldUseShell(),
  })
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      process.stderr.write(`\n  ✗  \`${cmd}\` not found on PATH. Install it and retry.\n\n`)
    } else {
      process.stderr.write(`\n  ✗  failed to run ${cmd}: ${r.error.message}\n\n`)
    }
    return 1
  }
  return r.status ?? 1
}

/** Run a command and capture stdout (used for terraform output → kubeconfig). */
export function capture(cmd: string, args: string[], cwd: string, profile?: string): CaptureResult {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: childEnv(profile),
    shell: shouldUseShell(),
  })
  return { status: r.status ?? 1, stdout: r.stdout ?? '' }
}

/** Block synchronously — the IaC flow is built on spawnSync, so we wait inline. */
export function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Split `cmd ... --output text` into whitespace-separated, non-empty tokens. */
export function textTokens(stdout: string): string[] {
  return stdout
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Read the recorded scaffold answers from dude.json (best-effort). */
export function readAnswers(projectRoot: string): Record<string, unknown> {
  try {
    const j = JSON.parse(readFileSync(path.join(projectRoot, 'dude.json'), 'utf8')) as {
      answers?: Record<string, unknown>
    }
    return j.answers ?? {}
  } catch {
    return {}
  }
}

/** Read `projectName` from dude.json — used as the Helm release name. */
export function projectName(projectRoot: string): string {
  const name = readAnswers(projectRoot).projectName
  return typeof name === 'string' && name ? name : 'app'
}

/** Resolve the `--env` flag (default `dev`). Rejects path-traversal values. */
export function resolveEnv(args: Record<string, unknown>): string {
  const env = String(args.env ?? 'dev')
  if (!/^[a-z][a-z0-9-]*$/.test(env)) {
    process.stderr.write(`error: invalid --env "${env}" (expected lowercase kebab-case).\n`)
    process.exit(1)
  }
  return env
}

/** Read a quoted `key = "value"` scalar from an HCL-ish file (best-effort). */
export function hclScalar(text: string, key: string): string {
  const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'))
  return m?.[1] ?? ''
}
