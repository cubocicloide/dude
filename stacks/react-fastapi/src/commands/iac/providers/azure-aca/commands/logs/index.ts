/** `dude iac logs` — stream a container app's console output. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { listApps, resolveApp } from '../../lib/apps.js'
import { run } from '../../lib/exec.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  resourceGroupFor,
  tfOutputRaw,
} from '../../lib/terraform.js'

export const iacLogsCommand: StackCommandDef = {
  available: hasIac,
  description: "Stream a container app's logs (az containerapp logs show).",
  args: {
    ...envArg,
    service: {
      type: 'string',
      description:
        'Which app to read: backend (default), frontend, worker, beat, redis — or a full app name.',
    },
    tail: { type: 'string', description: 'How many past lines to show first (default: 50).' },
    follow: { type: 'boolean', description: 'Keep streaming new output (like tail -f).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const group =
      tfOutputRaw(projectRoot, 'resource_group_name', subscription) ||
      resourceGroupFor(projectRoot, env)

    // The deployed set depends on the scaffold answers (no worker without
    // --celery, no beat without --celerybeat), so the valid choices are read
    // from Azure rather than hard-coded — and listing them is what makes a typo
    // recoverable instead of a bare "not found".
    const apps = listApps(projectRoot, group, subscription)
    if (!apps.length) {
      process.stderr.write(
        `\n  ✗  No container apps found in "${group}".\n` +
          `     Has this environment been provisioned? Try: dude iac apply --env ${env}\n\n`,
      )
      process.exit(1)
    }

    const wanted = String(args.service ?? 'backend')
    const app = resolveApp(apps, wanted)
    if (!app) {
      process.stderr.write(
        `\n  ✗  No app matching "${wanted}" in this environment.\n` +
          `     Available: ${apps.map((a) => a.name).join(', ')}\n\n`,
      )
      process.exit(1)
    }

    const cliArgs = [
      'containerapp',
      'logs',
      'show',
      '--name',
      app.name,
      '--resource-group',
      group,
      '--tail',
      String(args.tail ?? '50'),
    ]
    if (args.follow) cliArgs.push('--follow')
    process.exit(run('az', cliArgs, projectRoot, subscription))
  },
}
