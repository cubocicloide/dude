import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

/** True when the project has a Django backend (manage.py present). */
function hasManagePy(projectRoot: string): boolean {
  return existsSync(path.join(projectRoot, 'backend', 'manage.py'))
}

function requiresManagePy(projectRoot: string): boolean {
  if (!hasManagePy(projectRoot)) {
    process.stderr.write(
      '\n  ✗  No Django manage.py found (expected backend/manage.py).\n' +
        '     Run this command from the root of a project scaffolded with the react-django stack.\n\n',
    )
    return false
  }
  return true
}

/**
 * Run `python manage.py <args>` inside the running backend container via
 * docker compose. Propagates the exit code; prints a hint when the compose
 * stack is not up.
 */
function manage(projectRoot: string, manageArgs: string[]): void {
  const result = spawnSync(
    'docker',
    ['compose', 'exec', 'backend', 'uv', 'run', 'python', 'manage.py', ...manageArgs],
    { cwd: projectRoot, stdio: 'inherit' },
  )
  if (result.error != null) {
    process.stderr.write(
      `error: could not run docker — ${result.error.message}\n` +
        'Make sure Docker is installed and running.\n',
    )
    process.exit(1)
  }
  if (result.status !== 0) {
    process.stderr.write(
      '\nhint: if the backend container is not running, start the stack first with `dude up`.\n',
    )
    process.exit(result.status ?? 1)
  }
}

export const makemigrationCommand: StackCommandDef = {
  available: hasManagePy,
  description:
    'Generate new Django migrations from model changes (manage.py makemigrations, runs inside the backend container).',
  args: {
    name: {
      type: 'string',
      description: 'Migration name (passed as --name to makemigrations).',
      required: false,
    },
    app: {
      type: 'string',
      description: 'Limit migration generation to one app label (e.g. users).',
      required: false,
    },
  },
  async run({ projectRoot, args }) {
    if (!requiresManagePy(projectRoot)) process.exit(1)
    const app = typeof args.app === 'string' && args.app ? args.app : null
    const name = typeof args.name === 'string' && args.name ? args.name : null
    const cmd = ['makemigrations']
    if (app) cmd.push(app)
    if (name) cmd.push('--name', name)
    manage(projectRoot, cmd)
  },
}

export const migrateCommand: StackCommandDef = {
  available: hasManagePy,
  description:
    'Apply pending Django migrations (manage.py migrate, runs inside the backend container).',
  args: {
    app: {
      type: 'string',
      description: 'Migrate a single app label (e.g. users).',
      required: false,
    },
    revision: {
      type: 'string',
      description: 'Target migration (e.g. 0001 or zero). Requires --app.',
      required: false,
    },
  },
  async run({ projectRoot, args }) {
    if (!requiresManagePy(projectRoot)) process.exit(1)
    const app = typeof args.app === 'string' && args.app ? args.app : null
    const revision = typeof args.revision === 'string' && args.revision ? args.revision : null
    if (revision && !app) {
      process.stderr.write(
        'error: --revision requires --app (Django targets migrations per app).\n' +
          'Example: dude db migrate --app users --revision 0001\n',
      )
      process.exit(1)
    }
    const cmd = ['migrate']
    if (app) cmd.push(app)
    if (revision) cmd.push(revision)
    cmd.push('--noinput')
    manage(projectRoot, cmd)
  },
}

export const rollbackCommand: StackCommandDef = {
  available: hasManagePy,
  description:
    'Roll back an app to an earlier migration (manage.py migrate <app> <target>, runs inside the backend container).',
  args: {
    app: {
      type: 'string',
      description: 'App label to roll back (e.g. users).',
      required: true,
    },
    to: {
      type: 'string',
      description: 'Target migration to roll back to (e.g. 0001, or zero to unapply all).',
      required: true,
    },
  },
  async run({ projectRoot, args }) {
    if (!requiresManagePy(projectRoot)) process.exit(1)
    const app = typeof args.app === 'string' && args.app ? args.app : null
    const to = typeof args.to === 'string' && args.to ? args.to : null
    if (!app || !to) {
      process.stderr.write(
        'error: both --app and --to are required.\n' +
          'Roll back to a specific migration:  dude db rollback --app users --to 0001\n' +
          'Unapply all migrations of an app:   dude db rollback --app users --to zero\n',
      )
      process.exit(1)
    }
    manage(projectRoot, ['migrate', app, to, '--noinput'])
  },
}

export const superuserCommand: StackCommandDef = {
  available: hasManagePy,
  description:
    'Create a Django admin superuser interactively (manage.py createsuperuser, runs inside the backend container).',
  args: {},
  async run({ projectRoot }) {
    if (!requiresManagePy(projectRoot)) process.exit(1)
    manage(projectRoot, ['createsuperuser'])
  },
}
