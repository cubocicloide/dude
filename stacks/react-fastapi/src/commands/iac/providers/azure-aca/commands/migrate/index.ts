/**
 * `dude iac migrate` — run `alembic upgrade head` as a Container Apps job.
 *
 * Container Apps has first-class one-off jobs, so migrations are a manually
 * triggered job that shares the backend image and its environment. Terraform
 * owns its definition; this command starts an execution and waits for it, so a
 * failed migration fails the deploy rather than being discovered later in the
 * backend's logs.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { sleepMs } from '../../../../shared.js'
import { capture } from '../../lib/exec.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  hasMigrations,
  resolveSubscription,
  resourceGroupFor,
  tfOutputRaw,
} from '../../lib/terraform.js'

/** How long to wait for a migration execution before giving up. */
const TIMEOUT_MS = 10 * 60 * 1000
const POLL_MS = 10_000

/**
 * Start the migration job and wait for the execution to finish. Returns 0 when
 * there is nothing to do (a project scaffolded without a database has no job),
 * when the migration succeeds, and non-zero when it fails or times out.
 */
export function runMigrations(
  projectRoot: string,
  subscription: string | undefined,
  env: string,
): number {
  const job = tfOutputRaw(projectRoot, 'migrate_job_name', subscription)
  if (!job) return 0 // no database in this project — nothing to migrate
  const group =
    tfOutputRaw(projectRoot, 'resource_group_name', subscription) ||
    resourceGroupFor(projectRoot, env)

  process.stdout.write(`\n  → running database migrations (${job})…\n`)
  const started = capture(
    'az',
    ['containerapp', 'job', 'start', '--name', job, '--resource-group', group, '--output', 'json'],
    projectRoot,
    subscription,
  )
  if (started.status !== 0) {
    process.stderr.write(
      `\n  ✗  Could not start the migration job "${job}".\n` +
        `     Inspect it with: az containerapp job show --name ${job} --resource-group ${group}\n\n`,
    )
    return 1
  }

  // `az containerapp job start` returns the execution it created; without its
  // name we would poll the most recent execution, which is a different job run
  // whenever two deploys overlap.
  let execution = ''
  try {
    const o = JSON.parse(started.stdout) as { name?: string; id?: string }
    execution = o.name ?? String(o.id ?? '').split('/').pop() ?? ''
  } catch {
    /* fall through — handled below */
  }
  if (!execution) {
    process.stderr.write(
      '\n  ⚠  The migration job started but did not report an execution name, so its\n' +
        '     result cannot be awaited. Check it with:\n' +
        `       az containerapp job execution list --name ${job} --resource-group ${group} -o table\n\n`,
    )
    return 0
  }

  const deadline = Date.now() + TIMEOUT_MS
  for (;;) {
    const r = capture(
      'az',
      [
        'containerapp',
        'job',
        'execution',
        'show',
        '--name',
        job,
        '--job-execution-name',
        execution,
        '--resource-group',
        group,
        '--query',
        'properties.status',
        '--output',
        'tsv',
      ],
      projectRoot,
      subscription,
    )
    const status = r.status === 0 ? r.stdout.trim() : ''
    if (status === 'Succeeded') {
      process.stdout.write('  ✓  Migrations applied.\n\n')
      return 0
    }
    if (status === 'Failed' || status === 'Degraded') {
      process.stderr.write(
        `\n  ✗  Migrations failed (${status}). Read the output with:\n` +
          `       az containerapp job logs show --name ${job} --resource-group ${group} \\\n` +
          `         --container migrate --execution ${execution}\n` +
          `     A finished replica is reaped quickly; if that reports no replicas, read the\n` +
          `     job's output from Log Analytics instead (ContainerAppConsoleLogs_CL).\n\n`,
      )
      return 1
    }
    if (Date.now() > deadline) {
      process.stderr.write(
        `\n  ✗  Migrations did not finish within ${TIMEOUT_MS / 60000} minutes (last status: ${status || 'unknown'}).\n` +
          `     The job is still running; follow it with:\n` +
          `       az containerapp job execution list --name ${job} --resource-group ${group} -o table\n\n`,
      )
      return 1
    }
    sleepMs(POLL_MS)
  }
}

export const iacMigrateCommand: StackCommandDef = {
  // Hidden entirely in a project scaffolded without a database: there is no
  // migration job to start, so offering the command would only ever produce an
  // explanation of why it cannot run.
  available: (projectRoot) => hasIac(projectRoot) && hasMigrations(projectRoot),
  description: 'Run database migrations (alembic upgrade head) as a one-off Container Apps job.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)

    const job = tfOutputRaw(projectRoot, 'migrate_job_name', subscription)
    if (!job) {
      process.stdout.write(
        '\n  ↷  This project has no database, so there is no migration job.\n' +
          '     Re-scaffold with `--database postgres` if you expected one.\n\n',
      )
      process.exit(0)
    }
    process.exit(runMigrations(projectRoot, subscription, env))
  },
}
