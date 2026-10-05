/** `dude iac push` — log in to ACR and push the backend + frontend images. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { doPush, requireAcrRepos, resolveTag, tagArg, warnTagExists } from '../../lib/images.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
} from '../../lib/terraform.js'

export const iacPushCommand: StackCommandDef = {
  available: hasIac,
  description: 'Log in to ACR and push the backend + frontend images (build them first).',
  args: { ...envArg, ...tagArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const repos = requireAcrRepos(projectRoot, subscription)
    warnTagExists(projectRoot, subscription, tag, repos)
    process.exit(doPush(projectRoot, subscription, tag, repos))
  },
}
