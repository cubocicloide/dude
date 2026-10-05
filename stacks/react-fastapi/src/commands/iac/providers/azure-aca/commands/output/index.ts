/** `dude iac output` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureOutput } from '../../../../azure/commands.js'
import { azureAcaTarget } from '../../lib/target.js'

export const iacOutputCommand = defineAzureOutput(azureAcaTarget)
