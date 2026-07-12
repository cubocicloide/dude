/** `dude iac fmt` — format all Terraform files. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { hasIac, requireIac, tf } from '../../lib/terraform.js'

export const iacFmtCommand: StackCommandDef = {
  available: hasIac,
  description: 'Format all Terraform files (terraform fmt -recursive).',
  async run({ projectRoot }) {
    if (!requireIac(projectRoot)) process.exit(1)
    process.exit(tf(projectRoot, ['fmt', '-recursive']))
  },
}
