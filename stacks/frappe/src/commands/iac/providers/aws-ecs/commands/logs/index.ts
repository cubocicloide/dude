/** `dude iac logs` — tail a service's CloudWatch logs. */
import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName, run } from '../../../../shared.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'
import { tfOutputRaw, tfvarsValue } from '../../lib/terraform.js'

const SERVICES = ['backend', 'frontend', 'websocket', 'worker', 'scheduler'] as const

/** `aws logs tail` is an AWS CLI v2 subcommand — v1 doesn't have it at all and
 * fails with a raw "invalid choice" argparse error that reads like a missing
 * subcommand. Detect v1 up front and fail with an actionable message instead. */
function awsCliMajorVersion(): number | undefined {
  const r = spawnSync('aws', ['--version'], { encoding: 'utf8' })
  const m = /aws-cli\/(\d+)\./.exec(`${r.stdout ?? ''}${r.stderr ?? ''}`)
  return m ? Number(m[1]) : undefined
}

export const iacLogsCommand: StackCommandDef = {
  available: hasIac,
  description: "Tail a service's CloudWatch logs (aws logs tail).",
  args: {
    ...envArg,
    service: {
      type: 'string',
      description:
        'Which service to tail: backend (default), frontend, websocket, worker, scheduler.',
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

    const awsMajor = awsCliMajorVersion()
    if (awsMajor !== undefined && awsMajor < 2) {
      process.stderr.write(
        `\n  ✗  \`aws logs tail\` requires AWS CLI v2 — this machine has v${awsMajor}.\n` +
          `     Upgrade: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html\n` +
          `     Or tail logs directly: aws logs filter-log-events --log-group-name /ecs/${projectName(projectRoot)}-${env}-${which}\n\n`,
      )
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
