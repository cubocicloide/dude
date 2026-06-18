/** `dude iac plan` — show the infrastructure changes Terraform would apply. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile, tf, varFile } from '../../lib/terraform.js'

export const iacPlanCommand: StackCommandDef = {
  available: hasIac,
  description: 'Show the infrastructure changes Terraform would apply for an environment.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    process.exit(tf(projectRoot, ['plan', varFile(env)], profile))
  },
}
