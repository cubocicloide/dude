/**
 * `dude app *` — manage custom Frappe apps in this project's apps/ directory.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { benchSh, shellQuote } from '../_docker.js'

const IN_BENCH = 'cd /home/frappe/frappe-bench'

export const newAppCommand: StackCommandDef = {
  description:
    'Scaffold a new custom Frappe app (bench new-app) and move it into this repo under apps/, linked into the bench in editable mode.',
  args: {
    name: {
      type: 'string',
      description: 'App name (snake_case python package name).',
      required: true,
    },
  },
  async run({ args }) {
    const name = String(args.name)
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      process.stderr.write('error: app name must be snake_case (e.g. my_app)\n')
      process.exit(1)
    }
    const q = shellQuote(name)
    benchSh(
      [
        IN_BENCH,
        `bench new-app ${q}`,
        // Relocate into the repo (mounted at /workspace/apps) and symlink back,
        // exactly like docker/init.sh does for existing apps.
        `rm -rf /workspace/apps/${q}`,
        `mv apps/${q} /workspace/apps/${q}`,
        `ln -s /workspace/apps/${q} apps/${q}`,
        `./env/bin/pip install --quiet -e apps/${q}`,
        `echo "App created in apps/${q}. Install it on the site with: dude app install --name ${q}"`,
      ].join(' && '),
    )
  },
}

export const installAppCommand: StackCommandDef = {
  description: 'Install an app from the bench onto the default site (bench install-app).',
  args: {
    name: { type: 'string', description: 'App name.', required: true },
  },
  async run({ args }) {
    const q = shellQuote(String(args.name))
    benchSh(`${IN_BENCH} && bench --site "$SITE_NAME" install-app ${q}`)
  },
}
