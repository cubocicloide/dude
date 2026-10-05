/** `dude iac deploy` — roll the container apps onto an image tag. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { doDeploy, requireAcrRepos, resolveTag, tagArg } from '../../lib/images.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
} from '../../lib/terraform.js'
import { runMigrations } from '../migrate/index.js'

export const iacDeployCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Deploy the app: record the image tag in terraform.tfvars and roll every container app onto it (terraform apply).',
  args: {
    ...envArg,
    ...tagArg,
    'skip-migrations': {
      type: 'boolean',
      description: 'Do not run the database migration job after rolling out.',
    },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const repos = requireAcrRepos(projectRoot, subscription)

    const code = doDeploy(projectRoot, subscription, env, tag, repos)
    if (code !== 0) process.exit(code)

    // Migrations run after the apply, because the job's own image tag is part of
    // what the apply just updated — starting it earlier would migrate with the
    // *previous* release's schema code. `runMigrations` is a no-op when the
    // project was scaffolded without a database, so there is nothing to gate on
    // here beyond the explicit opt-out.
    if (!args['skip-migrations']) {
      const migrated = runMigrations(projectRoot, subscription, env)
      if (migrated !== 0) process.exit(migrated)
    }
    process.exit(0)
  },
}
