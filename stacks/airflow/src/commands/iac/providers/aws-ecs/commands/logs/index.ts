/** `dude iac logs` — tail the service's CloudWatch logs. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName, run } from '../../../../shared.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveProfile,
  tfOutputRaw,
  tfvarsValue,
} from '../../lib/terraform.js'

export const iacLogsCommand: StackCommandDef = {
  available: hasIac,
  description: "Tail the service's CloudWatch logs (aws logs tail).",
  args: {
    ...envArg,
    since: {
      type: 'string',
      description: 'How far back to start (e.g. 15m, 2h, 1d). Default: 15m.',
    },
    follow: { type: 'boolean', description: 'Keep streaming new log events (like tail -f).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    const group =
      tfOutputRaw(projectRoot, 'log_group', profile) || `/ecs/${projectName(projectRoot)}-${env}`
    const region = tfOutputRaw(projectRoot, 'region', profile) || tfvarsValue(projectRoot, env, 'region')

    const cliArgs = ['logs', 'tail', group, '--since', String(args.since ?? '15m')]
    if (args.follow) cliArgs.push('--follow')
    if (region) cliArgs.push('--region', region)
    process.exit(run('aws', cliArgs, projectRoot, profile))
  },
}
