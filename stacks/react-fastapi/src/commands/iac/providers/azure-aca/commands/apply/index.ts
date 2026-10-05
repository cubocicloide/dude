/** `dude iac apply` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureApply } from '../../../../azure/commands.js'
import { azureAcaTarget } from '../../lib/target.js'

export const iacApplyCommand = defineAzureApply(azureAcaTarget)
