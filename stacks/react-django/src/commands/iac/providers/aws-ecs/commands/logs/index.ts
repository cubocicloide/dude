/** `dude iac logs` — tail a service's CloudWatch logs. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName, run } from '../../../../shared.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'
import { tfOutputRaw, tfvarsValue } from '../../lib/terraform.js'

const SERVICES = ['backend', 'frontend', 'worker', 'beat'] as const

export const iacLogsCommand: StackCommandDef = {
  available: hasIac,
  description: "Tail a service's CloudWatch logs (aws logs tail).",
  args: {
    ...envArg,
    service: {
      type: 'string',
      description: 'Which service to tail: backend (default), frontend, worker, beat.',
    },
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

    const which = String(args.service ?? 'backend')
    if (!SERVICES.includes(which as (typeof SERVICES)[number])) {
      process.stderr.write(`\n  ✗  Unknown --service "${which}" (use: ${SERVICES.join(', ')}).\n\n`)
      process.exit(1)
    }

    // Log groups follow the scaffold convention /ecs/<project>-<env>-<service>.
    const group = `/ecs/${projectName(projectRoot)}-${env}-${which}`
    const region =
      tfOutputRaw(projectRoot, 'region', profile) || tfvarsValue(projectRoot, env, 'region')

    const cliArgs = ['logs', 'tail', group, '--since', String(args.since ?? '15m')]
    if (args.follow) cliArgs.push('--follow')
    if (region) cliArgs.push('--region', region)
    process.exit(run('aws', cliArgs, projectRoot, profile))
  },
}
