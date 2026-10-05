/** `dude iac status` — show every container app in an environment. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { listApps } from '../../lib/apps.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  resourceGroupFor,
  tfOutputRaw,
} from '../../lib/terraform.js'

export const iacStatusCommand: StackCommandDef = {
  available: hasIac,
  description: 'Show the container apps in an environment: running state, revision and public URL.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const group =
      tfOutputRaw(projectRoot, 'resource_group_name', subscription) ||
      resourceGroupFor(projectRoot, env)

    const apps = listApps(projectRoot, group, subscription)
    if (!apps.length) {
      process.stderr.write(
        `\n  ✗  No container apps found in "${group}".\n` +
          `     Has this environment been provisioned? Try: dude iac apply --env ${env}\n\n`,
      )
      process.exit(1)
    }

    const w = Math.max(...apps.map((a) => a.name.length), 4)
    process.stdout.write(`\n  Resource group: ${group}\n\n`)
    process.stdout.write(`  ${'APP'.padEnd(w)}  ${'STATUS'.padEnd(10)}  REVISION\n`)
    for (const a of apps) {
      process.stdout.write(
        `  ${a.name.padEnd(w)}  ${a.runningStatus.padEnd(10)}  ${a.latestRevision}\n`,
      )
    }

    const exposed = apps.filter((a) => a.fqdn)
    if (exposed.length) {
      process.stdout.write('\n  Public endpoints:\n')
      for (const a of exposed) process.stdout.write(`    ${a.name}: https://${a.fqdn}/\n`)
    }
    process.stdout.write(`\n  Logs: dude iac logs --env ${env} --service <app>\n\n`)
  },
}
