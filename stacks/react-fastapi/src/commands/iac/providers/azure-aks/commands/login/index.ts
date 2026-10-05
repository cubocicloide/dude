/** `dude iac login` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureLogin } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacLoginCommand = defineAzureLogin(azureAksTarget)
