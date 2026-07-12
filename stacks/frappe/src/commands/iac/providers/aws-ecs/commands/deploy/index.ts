/** `dude iac deploy` — roll every ECS service onto an image tag. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { doDeploy, requireEcsTarget, resolveTag, tagArg } from '../../lib/images.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacDeployCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Deploy: record the image tag in terraform.tfvars and roll all ECS services (frontend/backend/websocket/worker/scheduler) onto it (terraform apply).',
  args: { ...envArg, ...tagArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const target = requireEcsTarget(projectRoot, profile)
    process.exit(doDeploy(projectRoot, profile, env, tag, target))
  },
}
