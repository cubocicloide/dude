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

    // ── Airflow's own health endpoint (scheduler/triggerer/dag-processor heartbeats) ──
    const airflowUrl = tfOutputRaw(projectRoot, 'airflow_url', profile)
    if (airflowUrl) {
      try {
        const res = await fetch(`${airflowUrl}/api/v2/monitor/health`, {
          signal: AbortSignal.timeout(10_000),
        })
        const health = (await res.json()) as Record<string, { status?: string }>
        process.stdout.write(`\n  Airflow health (${airflowUrl}):\n`)
        for (const [component, info] of Object.entries(health)) {
          const ok = info?.status === 'healthy'
          process.stdout.write(`     ${ok ? '✓' : '✗'} ${component}: ${info?.status ?? '?'}\n`)
        }
      } catch {
        process.stdout.write(
          `\n  ✗ Airflow health endpoint unreachable (${airflowUrl}/api/v2/monitor/health)\n` +
            `    — check allowed_cidrs, or that the web service has healthy tasks above.\n`,
        )
      }
    }

    // ── Recently stopped dedicated worker containers (ECS-executor tasks) ──
    const workerFamily =
      tfOutputRaw(projectRoot, 'worker_task_definition', profile) || `${conventional}-worker`
    const stopped = awsCapture(
      'aws',
      [
        'ecs',
        'list-tasks',
        '--cluster',
        cluster,
        '--family',
        workerFamily,
        '--desired-status',
        'STOPPED',
        '--max-items',
        '5',
        '--output',
        'json',
        ...regionFlag,
      ],
      projectRoot,
      profile,
    )
    if (stopped.status === 0) {
      try {
        const arns = (JSON.parse(stopped.stdout) as { taskArns?: string[] }).taskArns ?? []
        if (arns.length) {
          const detail = awsCapture(
            'aws',
            ['ecs', 'describe-tasks', '--cluster', cluster, '--tasks', ...arns, '--output', 'json', ...regionFlag],
            projectRoot,
            profile,
          )
          const tasks =
            detail.status === 0
              ? ((JSON.parse(detail.stdout) as {
                  tasks?: Array<{
                    stoppedAt?: string
                    stoppedReason?: string
                    containers?: Array<{ exitCode?: number }>
                  }>
                }).tasks ?? [])
              : []
          if (tasks.length) {
            process.stdout.write(`\n  Recent dedicated worker containers (${workerFamily}):\n`)
            for (const t of tasks) {
              const exit = t.containers?.[0]?.exitCode
              const when = t.stoppedAt ? String(t.stoppedAt).slice(0, 19) : ''
              process.stdout.write(
                `     ${exit === 0 ? '✓' : '✗'} exit ${exit ?? '?'}  ${when}  ${t.stoppedReason ?? ''}\n`,
              )
            }
          }
        }
      } catch {
        /* worker history is best-effort */
      }
    }

    const dashboardUrl = tfOutputRaw(projectRoot, 'dashboard_url', profile)
    if (airflowUrl) process.stdout.write(`\n  Airflow UI:  ${airflowUrl}\n`)
    if (dashboardUrl) process.stdout.write(`  Dashboard:   ${dashboardUrl}\n`)
    process.stdout.write(
      `  Live logs:   dude iac logs --env ${env} --follow [--service scheduler]\n\n`,
    )
  },
}
