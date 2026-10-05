/** `dude iac output` — print Terraform outputs for an environment. */
import type { StackCommandDef } from '@cubocicloide/dude'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  tf,
} from '../../lib/terraform.js'

export const iacOutputCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Print Terraform outputs for an environment (cluster name, ACR URLs, app URL, database endpoint…).',
  args: {
    ...envArg,
    json: { type: 'boolean', description: 'Emit machine-readable JSON.' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const extra = args.json ? ['-json'] : []
    process.exit(tf(projectRoot, ['output', ...extra], subscription))
  },
}
