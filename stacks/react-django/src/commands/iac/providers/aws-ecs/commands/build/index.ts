/** `dude iac build` — build the backend + frontend production images. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { doBuild, platformArg, requireEcsTarget, resolveTag, tagArg } from '../../lib/images.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacBuildCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Build the backend + frontend production images (Dockerfile.prod), tagged for the shared ECR repos.',
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
