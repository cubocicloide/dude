import type { StackCommandDef } from '@cubocicloide/dude'
import { benchSh, shellQuote } from '../_docker.js'

export const testCommand: StackCommandDef = {
  description: "Run a custom app's test suite on the default site (bench run-tests).",
  args: {
    app: {
      type: 'string',
      description: 'App to test (default: ticketing).',
      default: 'ticketing',
    },
    module: {
      type: 'string',
      description: 'Run a single test module (dotted path) instead of the whole app.',
      required: false,
    },
  },
  async run({ args }) {
    const app = shellQuote(String(args.app ?? 'ticketing'))
    const module = typeof args.module === 'string' && args.module ? args.module : null
    const target = module ? `--module ${shellQuote(module)}` : `--app ${app}`
    benchSh(`cd /home/frappe/frappe-bench && bench --site "$SITE_NAME" run-tests ${target}`)
  },
}
