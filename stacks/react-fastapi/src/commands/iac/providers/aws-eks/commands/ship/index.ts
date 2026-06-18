/** `dude iac ship` — build, push and deploy in one step (the local inner loop). */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import {
  doBuild,
  doDeploy,
  doPush,
  platformArg,
  requireEcrRepos,
  resolveTag,
  tagArg,
} from '../../lib/images.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

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
    const profile = resolveProfile(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const repos = requireEcrRepos(projectRoot, profile)
    const ns = String(args.namespace ?? env)
    const platform = String(args.platform ?? 'linux/amd64')
    const project = projectName(projectRoot)

    let code = doBuild(projectRoot, profile, tag, repos, project, platform)
    if (code !== 0) process.exit(code)
    code = doPush(projectRoot, profile, tag, repos)
    if (code !== 0) process.exit(code)
    code = doDeploy(projectRoot, profile, env, ns, tag, repos)
    if (code === 0) {
      process.stdout.write(`\n  ✓  Shipped ${project}:${tag} to "${env}".\n\n`)
    }
    process.exit(code)
  },
}
