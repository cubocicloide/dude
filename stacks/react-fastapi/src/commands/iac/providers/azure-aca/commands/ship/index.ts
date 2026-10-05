/** `dude iac ship` — build, push and deploy in one step (the local inner loop). */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import {
  doBuild,
  doDeploy,
  doPush,
  platformArg,
  requireAcrRepos,
  resolveTag,
  tagArg,
  warnTagExists,
} from '../../lib/images.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
} from '../../lib/terraform.js'
import { runMigrations } from '../migrate/index.js'

export const iacShipCommand: StackCommandDef = {
  available: hasIac,
  description: 'Build, push, and deploy in one step (the local inner loop).',
  args: {
    ...envArg,
    ...tagArg,
    ...platformArg,
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
    const platform = String(args.platform ?? 'linux/amd64')
    const project = projectName(projectRoot)

    // Said before the build, not after: an amd64 image emulated on an arm64
    // laptop takes minutes, and knowing the tag will be reused is worth more
    // while you can still cancel.
    warnTagExists(projectRoot, subscription, tag, repos)

    let code = doBuild(projectRoot, subscription, tag, repos, project, platform)
    if (code !== 0) process.exit(code)
    code = doPush(projectRoot, subscription, tag, repos)
    if (code !== 0) process.exit(code)
    code = doDeploy(projectRoot, subscription, env, tag, repos)
    if (code !== 0) process.exit(code)

    if (!args['skip-migrations']) {
      code = runMigrations(projectRoot, subscription, env)
      if (code !== 0) process.exit(code)
    }

    process.stdout.write(`\n  ✓  Shipped ${project}:${tag} to "${env}".\n`)
    if (repos.appUrl) process.stdout.write(`     ${repos.appUrl}\n`)
    process.stdout.write('\n')
    process.exit(0)
  },
}
