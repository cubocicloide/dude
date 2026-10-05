/** `dude iac apply` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureApply } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacApplyCommand = defineAzureApply(azureAksTarget)
