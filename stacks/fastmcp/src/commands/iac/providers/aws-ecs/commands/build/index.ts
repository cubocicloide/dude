/** `dude iac build` — build the server production image. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { doBuild, platformArg, requireEcsTarget, resolveTag, tagArg } from '../../lib/images.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacBuildCommand: StackCommandDef = {
  available: hasIac,
  description: 'Build the server production image (fastmcp/Dockerfile.prod), tagged for the shared ECR.',
  args: { ...envArg, ...tagArg, ...platformArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const target = requireEcsTarget(projectRoot, profile)
    const platform = String(args.platform ?? 'linux/amd64')
    process.exit(doBuild(projectRoot, profile, tag, target, platform))
  },
}
