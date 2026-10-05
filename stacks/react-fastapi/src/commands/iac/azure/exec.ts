/**
 * `run` / `capture` for every Azure provider: containerized tools (terraform and
 * friends) are routed through the Docker runner, everything else runs natively —
 * as does everything when Docker is unavailable or `DUDE_IAC_RUNNER=host` is set.
 *
 * Signature-compatible with the generic helpers in `../shared.js`, except that
 * the credential argument is an Azure **subscription id** rather than an AWS
 * profile: it becomes `ARM_SUBSCRIPTION_ID`/`AZURE_SUBSCRIPTION_ID` in the child
 * environment instead of `AWS_PROFILE`.
 */
import { spawnSync } from 'node:child_process'
import { captureWith, runWith, type CaptureResult } from '../shared.js'
import { CONTAINERIZED, dockerRunArgs, useRunner } from './runner.js'

export type { CaptureResult }

/**
 * The child environment for every Azure tool invocation.
 *
 * `ARM_SUBSCRIPTION_ID` is what the azurerm Terraform provider reads (v4 requires
 * it to be set one way or another); `AZURE_SUBSCRIPTION_ID` is the matching knob
 * for other SDKs and for `az` itself. Setting both means a command is pinned to
 * the environment's subscription without mutating the user's `az account set`
 * default — so two environments in two subscriptions never bleed into each other.
 */
export function azureEnv(subscription?: string): NodeJS.ProcessEnv {
  if (!subscription) return process.env
  return {
    ...process.env,
    ARM_SUBSCRIPTION_ID: subscription,
    AZURE_SUBSCRIPTION_ID: subscription,
  }
}

function routed(cmd: string, cwd: string): boolean {
  return CONTAINERIZED.has(cmd) && useRunner(cwd)
}

/**
 * Run a command (inheriting stdio), in the runner container when applicable.
 * `prelude` is bash run inside the container before the tool — the Kubernetes
 * target uses it to pin the kubeconfig. It is ignored on the native fallback
 * path, which uses the host's own configuration as-is.
 */
export function run(
  cmd: string,
  args: string[],
  cwd: string,
  subscription?: string,
  prelude?: string[],
): number {
  if (!routed(cmd, cwd)) return runWith(cmd, args, cwd, azureEnv(subscription))
  const dargs = dockerRunArgs(cmd, args, cwd, subscription, {
    tty: !!process.stdin.isTTY,
    prelude,
  })
  const r = spawnSync('docker', dargs, { stdio: 'inherit' })
  if (r.error) {
    process.stderr.write(`\n  ✗  failed to run docker: ${r.error.message}\n\n`)
    return 1
  }
  return r.status ?? 1
}

/** Capture stdout, in the runner container when applicable. See `run` for `prelude`. */
export function capture(
  cmd: string,
  args: string[],
  cwd: string,
  subscription?: string,
  prelude?: string[],
): CaptureResult {
  if (!routed(cmd, cwd)) return captureWith(cmd, args, cwd, azureEnv(subscription))
  const dargs = dockerRunArgs(cmd, args, cwd, subscription, { tty: false, prelude })
  const r = spawnSync('docker', dargs, { encoding: 'utf8' })
  return { status: r.status ?? 1, stdout: r.stdout ?? '' }
}
