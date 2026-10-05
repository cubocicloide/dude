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

export const iacShipCommand: StackCommandDef = {
  available: hasIac,
  description: 'Build, push, and deploy in one step (the local inner loop).',
  args: {
    ...envArg,
    ...tagArg,
    ...platformArg,
    namespace: { type: 'string', description: 'Kubernetes namespace (default: the environment).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const repos = requireAcrRepos(projectRoot, subscription)
    const ns = String(args.namespace ?? env)
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
    code = doDeploy(projectRoot, subscription, env, ns, tag, repos)
    if (code === 0) {
      process.stdout.write(`\n  ✓  Shipped ${project}:${tag} to "${env}".\n`)
      if (repos.host) process.stdout.write(`     http://${repos.host}/\n`)
      process.stdout.write('\n')
    }
    process.exit(code)
  },
}
