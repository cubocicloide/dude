/** `dude iac build` — build the backend + frontend production images. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import { doBuild, platformArg, requireEcrRepos, resolveTag, tagArg } from '../../lib/images.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacBuildCommand: StackCommandDef = {
  available: hasIac,
  description: 'Build the backend + frontend production images, tagged for the env ECR.',
  args: { ...envArg, ...tagArg, ...platformArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const repos = requireEcrRepos(projectRoot, profile)
    const platform = String(args.platform ?? 'linux/amd64')
    process.exit(doBuild(projectRoot, profile, tag, repos, projectName(projectRoot), platform))
  },
}
