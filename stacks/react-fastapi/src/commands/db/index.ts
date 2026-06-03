import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

function requiresAlembic(projectRoot: string): boolean {
  if (!existsSync(path.join(projectRoot, 'backend', 'alembic.ini'))) {
    process.stderr.write(
      '\n  ✗  No Alembic configuration found.\n' +
        '     This project was not initialised with PostgreSQL support.\n\n',
    )
    return false
  }
  return true
}

export const makemigrationCommand: StackCommandDef = {
  description:
    'Autogenerate a new Alembic migration from model changes (runs inside the backend container).',
  args: {
    message: {
      type: 'string',
      description: 'Short description of the migration.',
      default: 'auto',
    },
  },
  async run({ projectRoot, args }) {
    if (!requiresAlembic(projectRoot)) process.exit(1)
    const msg = String(args.message ?? 'auto')
    const result = spawnSync(
      'docker',
      ['compose', 'exec', 'backend', 'uv', 'run', 'alembic', 'revision', '--autogenerate', '-m', msg],
      { cwd: projectRoot, stdio: 'inherit' },
    )
    if (result.status !== 0) process.exit(result.status ?? 1)
  },
}

export const migrateCommand: StackCommandDef = {
  description: 'Apply all pending Alembic migrations (runs inside the backend container).',
  args: {
    revision: {
      type: 'string',
      description: 'Target revision (default: head).',
      default: 'head',
    },
  },
  async run({ projectRoot, args }) {
    if (!requiresAlembic(projectRoot)) process.exit(1)
    const rev = String(args.revision ?? 'head')
    const result = spawnSync(
      'docker',
      ['compose', 'exec', 'backend', 'uv', 'run', 'alembic', 'upgrade', rev],
      { cwd: projectRoot, stdio: 'inherit' },
    )
    if (result.status !== 0) process.exit(result.status ?? 1)
  },
}

export const rollbackCommand: StackCommandDef = {
  description: 'Downgrade by one Alembic revision (runs inside the backend container).',
  args: {
    revision: {
      type: 'string',
      description: 'Target revision (default: -1).',
      default: '-1',
    },
  },
  async run({ projectRoot, args }) {
    if (!requiresAlembic(projectRoot)) process.exit(1)
    const rev = String(args.revision ?? '-1')
    const result = spawnSync(
      'docker',
      ['compose', 'exec', 'backend', 'uv', 'run', 'alembic', 'downgrade', rev],
      { cwd: projectRoot, stdio: 'inherit' },
    )
    if (result.status !== 0) process.exit(result.status ?? 1)
  },
}
