/**
 * `dude iac create-site` — first-deploy step: provision the frappe site on the
 * shared EFS `sites/` volume.
 *
 * Runs TWO one-off Fargate tasks in sequence:
 *   1. `configurator` — writes `common_site_config.json` on the sites volume
 *      (db host, redis URLs, socketio port) and seeds the built assets links,
 *   2. `create-site` — `bench new-site` against RDS MariaDB with the admin
 *      password from Secrets Manager, installing the apps baked into the image.
 *
 * Both tasks are idempotent (the site task exits 0 when the site already
 * exists), so re-running after a partial failure is safe. The configurator is
 * also re-run here on purpose: it refreshes the config when an endpoint
 * changed (e.g. Redis was recreated).
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { readOneOffTarget, runOneOffTask } from '../../lib/tasks.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacCreateSiteCommand: StackCommandDef = {
  available: hasIac,
  description:
    'First-deploy step: configure the bench (common_site_config) and create the frappe site (bench new-site) as one-off ECS Fargate tasks.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    const read = readOneOffTarget(projectRoot, profile, [
      'configurator_task_definition',
      'create_site_task_definition',
    ])
    if (!read) {
      process.stderr.write(
        'error: could not read Terraform outputs (create_site_task_definition, cluster_name, …) — run `dude iac apply` first.\n',
      )
      process.exit(1)
    }

    let code = runOneOffTask(
      projectRoot,
      profile,
      read.target,
      read.taskDefinitions.configurator_task_definition!,
      `configurator on "${env}"`,
    )
    if (code !== 0) {
      process.stderr.write(
        `     Inspect the logs with: dude iac logs --env ${env} --service backend\n\n`,
      )
      process.exit(code)
    }
    process.stdout.write('  ✓  Bench configured (common_site_config.json).\n')

    code = runOneOffTask(
      projectRoot,
      profile,
      read.target,
      read.taskDefinitions.create_site_task_definition!,
      `site creation on "${env}"`,
    )
    if (code === 0) {
      process.stdout.write(
        '\n  ✓  Site ready. The frontend/backend services become healthy on their\n' +
          '     next health check. Log in as Administrator with the admin password\n' +
          '     stored in Secrets Manager (see `dude iac output --env ' +
          env +
          '`).\n\n',
      )
      process.exit(0)
    }
    process.stderr.write(
      `     Inspect the logs with: dude iac logs --env ${env} --service backend\n\n`,
    )
    process.exit(code)
  },
}
