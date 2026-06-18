/** `dude iac init` — initialise Terraform for an environment (S3 remote backend). */
import type { StackCommandDef } from '@cubocicloide/dude'
import { backendConfig, envArg, hasIac, requireEnv, requireIac, resolveProfile, tf } from '../../lib/terraform.js'

export const iacInitCommand: StackCommandDef = {
  available: hasIac,
  description: 'Initialise Terraform for an environment (configures the S3 remote backend).',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    process.exit(tf(projectRoot, ['init', backendConfig(env)], profile))
  },
}
