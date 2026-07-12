/** `dude iac status` — show an ECS service's state, tasks and recent events. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, projectName } from '../../../../shared.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveProfile,
  tfOutputRaw,
  tfvarsValue,
} from '../../lib/terraform.js'

const SERVICES = ['backend', 'frontend', 'websocket', 'worker', 'scheduler'] as const

export const iacStatusCommand: StackCommandDef = {
  available: hasIac,
  description: 'Show an ECS service state, running tasks and recent deployment events.',
  args: {
    ...envArg,
    service: {
      type: 'string',
      description: 'Which service to inspect: backend (default), frontend, websocket, worker, scheduler.',
    },
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

    // Prefer Terraform outputs; fall back to the scaffold convention so status
    // still works when outputs are unavailable (e.g. state partially applied).
    const conventional = `${projectName(projectRoot)}-${env}-${which}`
    const cluster =
      tfOutputRaw(projectRoot, 'cluster_name', profile) || `${projectName(projectRoot)}-${env}`
    const service = tfOutputRaw(projectRoot, `${which}_service_name`, profile) || conventional
    const region =
      tfOutputRaw(projectRoot, 'region', profile) || tfvarsValue(projectRoot, env, 'region')
    const regionFlag = region ? ['--region', region] : []

    const r = capture(
      'aws',
      [
        'ecs',
        'describe-services',
        '--cluster',
        cluster,
        '--services',
        service,
        '--output',
        'json',
        ...regionFlag,
      ],
      projectRoot,
      profile,
    )
    if (r.status !== 0) {
      process.stderr.write(
        `\n  ✗  Could not describe service "${service}" on cluster "${cluster}".\n` +
          `     Is the environment provisioned? Try: dude iac apply --env ${env}\n\n`,
      )
      process.exit(1)
    }

    interface Deployment {
      status?: string
      rolloutState?: string
      taskDefinition?: string
      runningCount?: number
      desiredCount?: number
    }
    interface Service {
      status?: string
      runningCount?: number
      pendingCount?: number
      desiredCount?: number
      deployments?: Deployment[]
      events?: Array<{ createdAt?: string; message?: string }>
    }
    let svc: Service | undefined
    try {
      svc = (JSON.parse(r.stdout) as { services?: Service[] }).services?.[0]
    } catch {
      /* fall through to the guard below */
    }
    if (!svc) {
      process.stderr.write(`\n  ✗  Service "${service}" not found on cluster "${cluster}".\n\n`)
      process.exit(1)
    }

    process.stdout.write(
      `\n  Service ${service} (cluster ${cluster})\n` +
        `     status:   ${svc.status ?? 'UNKNOWN'}\n` +
        `     tasks:    ${svc.runningCount ?? 0} running / ${svc.pendingCount ?? 0} pending / ${svc.desiredCount ?? 0} desired\n`,
    )
    for (const d of svc.deployments ?? []) {
      const taskDef = d.taskDefinition?.split('/').pop() ?? ''
      process.stdout.write(
        `     deploy:   ${d.status ?? ''} ${d.rolloutState ?? ''}  ${taskDef}  (${d.runningCount ?? 0}/${d.desiredCount ?? 0})\n`,
      )
    }

    const events = (svc.events ?? []).slice(0, 5)
    if (events.length) {
      process.stdout.write(`\n  Recent events:\n`)
      for (const e of events) {
        process.stdout.write(`     ${e.createdAt ?? ''}  ${e.message ?? ''}\n`)
      }
    }

    const appUrl = tfOutputRaw(projectRoot, 'app_url', profile)
    if (appUrl) process.stdout.write(`\n  App URL: ${appUrl}\n`)
    process.stdout.write('\n')
  },
}
