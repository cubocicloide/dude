/**
 * Shared docker compose runner for this stack's Docker commands.
 * Not a command module — imported only by the command modules.
 */
import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'

export function dc(args: string[]): void {
  const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' })
  process.exit(result.status ?? 0)
}

/** Run a shell command inside the running bench container and exit with its status. */
export function benchSh(cmd: string): void {
  dc(['exec', 'bench', 'bash', '-lc', cmd])
}

/** Quote a string for safe interpolation into a bash -lc command line. */
export function shellQuote(s: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s
  return `'${s.replaceAll("'", `'\\''`)}'`
}

export function isDockerRunning(): boolean {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' })
  return r.error == null && r.status === 0
}

export type { StackCommandDef }
