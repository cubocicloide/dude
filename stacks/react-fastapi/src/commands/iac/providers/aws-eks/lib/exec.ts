/**
 * Provider-local `run` / `capture` that transparently route containerized tools
 * (terraform/kubectl/helm/k9s) through the Docker runner, falling back to the
 * generic native helpers for everything else — or when Docker is unavailable /
 * `DUDE_IAC_RUNNER=host` is set.
 *
 * These are drop-in replacements for the generic `run`/`capture` in
 * `../../shared.js`: same signatures, so a module opts in just by changing its
 * import. The generic helpers stay provider-agnostic (no Docker/AWS knowledge).
 */
import { spawnSync } from 'node:child_process'
import {
  capture as nativeCapture,
  run as nativeRun,
  type CaptureResult,
} from '../../../shared.js'
import { CONTAINERIZED, dockerRunArgs, useRunner } from './runner.js'

export type { CaptureResult }

function routed(cmd: string, cwd: string): boolean {
  return CONTAINERIZED.has(cmd) && useRunner(cwd)
}

/** Run a command (inheriting stdio), in the runner container when applicable. */
export function run(cmd: string, args: string[], cwd: string, profile?: string): number {
  if (!routed(cmd, cwd)) return nativeRun(cmd, args, cwd, profile)
  const dargs = dockerRunArgs(cmd, args, cwd, profile, { tty: !!process.stdin.isTTY })
  const r = spawnSync('docker', dargs, { stdio: 'inherit' })
  if (r.error) {
    process.stderr.write(`\n  ✗  failed to run docker: ${r.error.message}\n\n`)
    return 1
  }
  return r.status ?? 1
}

/** Capture stdout, in the runner container when applicable. */
export function capture(
  cmd: string,
  args: string[],
  cwd: string,
  profile?: string,
): CaptureResult {
  if (!routed(cmd, cwd)) return nativeCapture(cmd, args, cwd, profile)
  const dargs = dockerRunArgs(cmd, args, cwd, profile, { tty: false })
  const r = spawnSync('docker', dargs, { encoding: 'utf8' })
  return { status: r.status ?? 1, stdout: r.stdout ?? '' }
}
