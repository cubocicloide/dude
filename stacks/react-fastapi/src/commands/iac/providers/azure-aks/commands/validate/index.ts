/** `dude iac validate` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureValidate } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacValidateCommand = defineAzureValidate(azureAksTarget)
