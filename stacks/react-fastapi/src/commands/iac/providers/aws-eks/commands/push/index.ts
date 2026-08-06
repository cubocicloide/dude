/** `dude iac push` — log in to ECR and push the backend + frontend images. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { doPush, requireEcrRepos, resolveTag, tagArg } from '../../lib/images.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacPushCommand: StackCommandDef = {
  available: hasIac,
  description: 'Log in to ECR and push the backend + frontend images (build them first).',
  args: { ...envArg, ...tagArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const repos = requireEcrRepos(projectRoot, profile)
    process.exit(doPush(projectRoot, profile, tag, repos, env))
  },
}
