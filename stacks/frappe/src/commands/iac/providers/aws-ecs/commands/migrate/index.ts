/** `dude iac migrate` — run `bench --site all migrate` as a one-off Fargate task. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { readOneOffTarget, runOneOffTask } from '../../lib/tasks.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacMigrateCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Run frappe migrations (bench --site all migrate) as a one-off ECS Fargate task. Run it after every deploy that changes DocTypes/patches.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    const read = readOneOffTarget(projectRoot, profile, ['migrate_task_definition'])
    if (!read) {
      process.stderr.write(
        'error: could not read Terraform outputs (migrate_task_definition, cluster_name, …) — run `dude iac apply` first.\n',
      )
      process.exit(1)
    }

    const code = runOneOffTask(
      projectRoot,
      profile,
      read.target,
      read.taskDefinitions.migrate_task_definition!,
      `migrations on "${env}"`,
    )
    if (code === 0) {
      process.stdout.write('\n  ✓  Migrations applied.\n\n')
      process.exit(0)
    }
    process.stderr.write(
      `     Inspect the logs with: dude iac logs --env ${env} --service backend\n\n`,
    )
    process.exit(code)
  },
}
