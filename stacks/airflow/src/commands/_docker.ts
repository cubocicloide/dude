/**
 * Shared docker compose runner for this stack's Docker commands.
 * Not a command module — imported only by up/, down/, logs/, shell/.
 */
import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'

export function dc(args: string[]): void {
  const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' })
  process.exit(result.status ?? 0)
}

export function isDockerRunning(): boolean {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' })
  return r.error == null && r.status === 0
}

export type { StackCommandDef }
