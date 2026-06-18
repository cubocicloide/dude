/** `dude iac validate` — validate the Terraform configuration. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { hasIac, requireIac, tf } from '../../lib/terraform.js'

export const iacValidateCommand: StackCommandDef = {
  available: hasIac,
  description: 'Validate the Terraform configuration.',
  async run({ projectRoot }) {
    if (!requireIac(projectRoot)) process.exit(1)
    process.exit(tf(projectRoot, ['validate']))
  },
}
