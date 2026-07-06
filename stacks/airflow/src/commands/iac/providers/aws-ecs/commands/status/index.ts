/** `dude iac status` — show the state of every ECS service, tasks and recent events. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture as awsCapture, projectName } from '../../../../shared.js'
import { capture } from '../../lib/exec.js'
import {
  TF_DIR,
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveProfile,
  tfOutputRaw,
  tfvarsValue,
} from '../../lib/terraform.js'

/** The env's ECS services from Terraform outputs, falling back to the scaffold convention. */
function readServices(projectRoot: string, profile: string, conventional: string): string[] {
  const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
  if (out.status === 0) {
    try {
      const o = JSON.parse(out.stdout) as Record<string, { value?: unknown }>
      const names = o.service_names?.value
      if (Array.isArray(names) && names.length) return names.map(String)
    } catch {
      /* fall through to the convention below */
    }
  }
  return [`${conventional}-web`, `${conventional}-core`]
}

export const iacStatusCommand: StackCommandDef = {
  available: hasIac,
  description: 'Show the ECS services state, running tasks and recent deployment events.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    // Prefer Terraform outputs; fall back to the scaffold convention so status
    // still works when outputs are unavailable (e.g. state partially applied).
    const conventional = `${projectName(projectRoot)}-${env}`
    const cluster = tfOutputRaw(projectRoot, 'cluster_name', profile) || conventional
    const services = readServices(projectRoot, profile, conventional)
    const region =
      tfOutputRaw(projectRoot, 'region', profile) || tfvarsValue(projectRoot, env, 'region')
    const regionFlag = region ? ['--region', region] : []

    const r = awsCapture(
      'aws',
      [
        'ecs',
        'describe-services',
        '--cluster',
        cluster,
        '--services',
        ...services,
        '--output',
        'json',
        ...regionFlag,
      ],
      projectRoot,
      profile,
    )
    if (r.status !== 0) {
      process.stderr.write(
        `\n  ✗  Could not describe services on cluster "${cluster}".\n` +
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
      serviceName?: string
      status?: string
      runningCount?: number
      pendingCount?: number
      desiredCount?: number
      deployments?: Deployment[]
      events?: Array<{ createdAt?: string; message?: string }>
    }
    let found: Service[] = []
    try {
      found = (JSON.parse(r.stdout) as { services?: Service[] }).services ?? []
    } catch {
      /* fall through to the guard below */
    }
    if (!found.length) {
      process.stderr.write(`\n  ✗  No services found on cluster "${cluster}".\n\n`)
      process.exit(1)
    }

    for (const svc of found) {
      process.stdout.write(
        `\n  Service ${svc.serviceName ?? '?'} (cluster ${cluster})\n` +
          `     status:   ${svc.status ?? 'UNKNOWN'}\n` +
          `     tasks:    ${svc.runningCount ?? 0} running / ${svc.pendingCount ?? 0} pending / ${svc.desiredCount ?? 0} desired\n`,
      )
      for (const d of svc.deployments ?? []) {
        const taskDef = d.taskDefinition?.split('/').pop() ?? ''
        process.stdout.write(
          `     deploy:   ${d.status ?? ''} ${d.rolloutState ?? ''}  ${taskDef}  (${d.runningCount ?? 0}/${d.desiredCount ?? 0})\n`,
        )
      }
      const events = (svc.events ?? []).slice(0, 3)
      if (events.length) {
        process.stdout.write(`     recent events:\n`)
        for (const e of events) {
          process.stdout.write(`       ${e.createdAt ?? ''}  ${e.message ?? ''}\n`)
        }
      }
    }

    const airflowUrl = tfOutputRaw(projectRoot, 'airflow_url', profile)
    if (airflowUrl) process.stdout.write(`\n  Airflow UI: ${airflowUrl}\n`)
    process.stdout.write('\n')
  },
}
