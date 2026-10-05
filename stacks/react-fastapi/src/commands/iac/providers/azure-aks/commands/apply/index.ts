/** `dude iac apply` — provision/update the infrastructure for an environment. */
import type { StackCommandDef } from '@cubocicloide/dude'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  tf,
  varFile,
} from '../../lib/terraform.js'

export const iacApplyCommand: StackCommandDef = {
  available: hasIac,
  description: 'Provision/update the infrastructure for an environment.',
  args: {
    ...envArg,
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const extra = args.yes ? ['-auto-approve'] : []
    process.exit(tf(projectRoot, ['apply', varFile(env), ...extra], subscription))
  },
}
