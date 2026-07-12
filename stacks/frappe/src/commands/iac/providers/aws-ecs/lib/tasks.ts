/**
 * One-off ECS Fargate task mechanics, shared by `dude iac create-site` and
 * `dude iac migrate`: read the network coordinates from Terraform outputs, run
 * a task definition with `aws ecs run-task`, then poll until it stops and
 * report the container's exit code.
 */
import { capture as awsCapture, sleepMs } from '../../../shared.js'
import { capture } from './exec.js'
import { TF_DIR } from './terraform.js'

/** Coordinates a one-off task needs, read from Terraform outputs. */
export interface OneOffTarget {
  cluster: string
  subnets: string[]
  securityGroup: string
  region: string
}

/**
 * Read the shared one-off coordinates plus the requested task-definition
 * outputs. Returns `null` when any coordinate is missing (infra not applied,
 * no creds, …); `taskDefinitions` maps each requested output name to its ARN.
 */
export function readOneOffTarget(
  projectRoot: string,
  profile: string,
  taskDefinitionOutputs: string[],
): { target: OneOffTarget; taskDefinitions: Record<string, string> } | null {
  const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
  if (out.status !== 0) return null
  try {
    const o = JSON.parse(out.stdout) as Record<string, { value?: unknown }>
    const cluster = String(o.cluster_name?.value ?? '')
    const subnets = Array.isArray(o.public_subnet_ids?.value)
      ? (o.public_subnet_ids!.value as string[])
      : []
    const securityGroup = String(o.app_security_group_id?.value ?? '')
    const region = String(o.region?.value ?? '')
    if (!cluster || !subnets.length || !securityGroup || !region) return null

    const taskDefinitions: Record<string, string> = {}
    for (const name of taskDefinitionOutputs) {
      const arn = String(o[name]?.value ?? '')
      if (!arn) return null
      taskDefinitions[name] = arn
    }
    return { target: { cluster, subnets, securityGroup, region }, taskDefinitions }
  } catch {
    return null
  }
}

/**
 * Run a one-off Fargate task and wait for it to stop. Prints progress; returns
 * the container's exit code (1 when the task could not be started/parsed).
 */
export function runOneOffTask(
  projectRoot: string,
  profile: string,
  target: OneOffTarget,
  taskDefinition: string,
  label: string,
): number {
  process.stdout.write(`\n  → running ${label} (${taskDefinition.split('/').pop()})…\n`)
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
      taskDefinition,
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
    return 1
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
      return 1
    }
  } catch {
    process.stderr.write('\n  ✗  Could not parse the run-task response.\n\n')
    return 1
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
    if (exitCode === 0) return 0
    process.stderr.write(
      `\n  ✗  ${label} task failed (exit ${exitCode ?? '?'}) — ${
        task.stoppedReason ?? task.containers?.[0]?.reason ?? 'no reason reported'
      }.\n`,
    )
    return typeof exitCode === 'number' && exitCode > 0 ? exitCode : 1
  }
}
