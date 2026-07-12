/**
 * `dude site *` — day-to-day operations on the default site ($SITE_NAME from
 * .env, injected into the bench container's environment by docker compose).
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { benchSh } from '../_docker.js'

const IN_BENCH = 'cd /home/frappe/frappe-bench'

export const migrateCommand: StackCommandDef = {
  description: 'Apply pending schema changes, patches and fixtures (bench migrate).',
  args: {},
  async run() {
    benchSh(`${IN_BENCH} && bench --site "$SITE_NAME" migrate`)
  },
}

export const consoleCommand: StackCommandDef = {
  description: 'Open an IPython console with the site loaded (bench console).',
  args: {},
  async run() {
    benchSh(`${IN_BENCH} && bench --site "$SITE_NAME" console`)
  },
}

export const backupCommand: StackCommandDef = {
  description:
    'Backup the site database (and optionally files) into the bench; copies land in sites/$SITE_NAME/private/backups.',
  args: {
    files: {
      type: 'boolean',
      description: 'Include public/private files in the backup.',
      default: false,
    },
  },
  async run({ args }) {
    const withFiles = Boolean(args.files) ? ' --with-files' : ''
    benchSh(`${IN_BENCH} && bench --site "$SITE_NAME" backup${withFiles}`)
  },
}

export const clearCacheCommand: StackCommandDef = {
  description: 'Clear the site cache and website cache (bench clear-cache).',
  args: {},
  async run() {
    benchSh(`${IN_BENCH} && bench --site "$SITE_NAME" clear-cache`)
  },
}

export const mariadbCommand: StackCommandDef = {
  description: "Open a MariaDB client connected to the site's database (bench mariadb).",
  args: {},
  async run() {
    benchSh(`${IN_BENCH} && bench --site "$SITE_NAME" mariadb`)
  },
}
