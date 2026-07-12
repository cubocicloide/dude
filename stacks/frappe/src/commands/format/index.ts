import { spawnSync } from 'node:child_process'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { isDockerRunning } from '../_docker.js'

/** Run ruff (official image) against the project's apps/ directory. */
export function ruff(projectRoot: string, ruffArgs: string[]): number {
  const appsDir = path.join(projectRoot, 'apps')
  const r = spawnSync(
    'docker',
    ['run', '--rm', '-v', `${appsDir}:/apps`, '-w', '/apps', 'ghcr.io/astral-sh/ruff:latest', ...ruffArgs],
    { stdio: 'inherit' },
  )
  return r.status ?? 1
}

export const formatCommand: StackCommandDef = {
  description: 'Format and autofix Python in apps/ with ruff (Frappe style — tabs).',
  args: {},
  async run({ projectRoot }) {
    if (!isDockerRunning()) {
      process.stderr.write('[format] Docker is not running. Start Docker Desktop and retry.\n')
      process.exit(1)
    }
    const fmt = ruff(projectRoot, ['format', '.'])
    const fix = ruff(projectRoot, ['check', '--fix', '.'])
    process.exit(fmt || fix ? 1 : 0)
  },
}
