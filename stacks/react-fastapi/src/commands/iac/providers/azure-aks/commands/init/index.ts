/** `dude iac init` — initialise Terraform for an environment (azurerm backend). */
import type { StackCommandDef } from '@cubocicloide/dude'
import {
  backendConfig,
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  tf,
} from '../../lib/terraform.js'

export const iacInitCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Initialise Terraform for an environment (configures the Azure Storage remote backend).',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    // All environments share one `iac/terraform` directory (and thus one
    // `.terraform` backend cache), but each has its own remote state (distinct
    // blob key in its backend.hcl). `-reconfigure` repoints the backend at the
    // requested env's state without trying to migrate the previous env's state
    // into it — switching envs would otherwise fail with "Backend configuration
    // changed". State is never shared between envs, so migration is never wanted.
    process.exit(tf(projectRoot, ['init', '-reconfigure', backendConfig(env)], subscription))
  },
}
