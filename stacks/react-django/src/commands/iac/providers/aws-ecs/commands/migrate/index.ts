/** `dude iac migrate` — run Django migrations as a one-off Fargate task. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture as awsCapture, sleepMs } from '../../../../shared.js'
import { capture } from '../../lib/exec.js'
import {
  TF_DIR,
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveProfile,
} from '../../lib/terraform.js'

interface MigrateTarget {
  cluster: string
  taskDefinition: string
  subnets: string[]
  securityGroup: string
  region: string
}

function readMigrateTarget(projectRoot: string, profile: string): MigrateTarget | null {
  const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
  if (out.status !== 0) return null
  try {
    const o = JSON.parse(out.stdout) as Record<string, { value?: unknown }>
    const cluster = String(o.cluster_name?.value ?? '')
    const taskDefinition = String(o.migrate_task_definition?.value ?? '')
    const subnets = Array.isArray(o.public_subnet_ids?.value)
      ? (o.public_subnet_ids!.value as string[])
      : []
    const securityGroup = String(o.backend_security_group_id?.value ?? '')
    const region = String(o.region?.value ?? '')
    if (!cluster || !taskDefinition || !subnets.length || !securityGroup || !region) return null
    return { cluster, taskDefinition, subnets, securityGroup, region }
  } catch {
    return null
  }
}

export const iacMigrateCommand: StackCommandDef = {
  available: hasIac,
  description: 'Run Django migrations (manage.py migrate) as a one-off ECS Fargate task.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    const target = readMigrateTarget(projectRoot, profile)
    if (!target) {
      process.stderr.write(
        'error: could not read Terraform outputs (migrate_task_definition, cluster_name, …) — run `dude iac apply` first.\n',
      )
      process.exit(1)
    }

    process.stdout.write(`\n  → running migrations on "${env}" (${target.taskDefinition})…\n`)
    const netConf =
      `awsvpcConfiguration={subnets=[${target.subnets.join(',')}],` +
      `securityGroups=[${target.securityGroup}],assignPublicIp=ENABLED}`
    const started = awsCapture(
      'aws',
      [
        'ecs',
        'run-task',
        '--cluster',
        target.cluster,
        '--task-definition',
        target.taskDefinition,
        '--launch-type',
        'FARGATE',
        '--count',
        '1',
        '--network-configuration',
        netConf,
        '--region',
        target.region,
        '--output',
        'json',
      ],
      projectRoot,
      profile,
    )
    if (started.status !== 0) {
      process.stderr.write('\n  ✗  aws ecs run-task failed.\n\n')
      process.exit(1)
    }

    let taskArn = ''
    try {
      const parsed = JSON.parse(started.stdout) as {
        tasks?: Array<{ taskArn?: string }>
        failures?: Array<{ reason?: string }>
      }
      taskArn = parsed.tasks?.[0]?.taskArn ?? ''
      if (!taskArn) {
        const reason = parsed.failures?.[0]?.reason ?? 'unknown'
        process.stderr.write(`\n  ✗  Task did not start (${reason}).\n\n`)
        process.exit(1)
      }
    } catch {
      process.stderr.write('\n  ✗  Could not parse the run-task response.\n\n')
      process.exit(1)
    }

    // Poll until the one-off task stops, then report its container exit code.
    process.stdout.write(`     task ${taskArn.split('/').pop()} started — waiting…\n`)
    for (;;) {
      sleepMs(5000)
      const described = awsCapture(
        'aws',
        [
          'ecs',
          'describe-tasks',
          '--cluster',
          target.cluster,
          '--tasks',
          taskArn,
          '--region',
          target.region,
          '--output',
          'json',
        ],
        projectRoot,
        profile,
      )
      if (described.status !== 0) continue
      let task:
        | {
            lastStatus?: string
            stoppedReason?: string
            containers?: Array<{ exitCode?: number; reason?: string }>
          }
        | undefined
      try {
        task = (JSON.parse(described.stdout) as { tasks?: Array<typeof task> }).tasks?.[0]
      } catch {
        continue
      }
      if (!task) continue
      if (task.lastStatus !== 'STOPPED') {
        process.stdout.write(`     ${task.lastStatus ?? '…'}\n`)
        continue
      }
      const exitCode = task.containers?.[0]?.exitCode
      if (exitCode === 0) {
        process.stdout.write('\n  ✓  Migrations applied.\n\n')
        process.exit(0)
      }
      process.stderr.write(
        `\n  ✗  Migration task failed (exit ${exitCode ?? '?'}) — ${
          task.stoppedReason ?? task.containers?.[0]?.reason ?? 'no reason reported'
        }.\n` + `     Inspect the logs with: dude iac logs --env ${env} --service backend\n\n`,
      )
      process.exit(typeof exitCode === 'number' && exitCode > 0 ? exitCode : 1)
    }
  },
}
