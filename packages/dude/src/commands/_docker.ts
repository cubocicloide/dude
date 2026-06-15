import { spawnSync } from 'node:child_process'

/** Run `docker compose <args>` and forward stdio to the terminal. */
export function dc(args: string[]): void {
  const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' })
  process.exit(result.status ?? 0)
}
