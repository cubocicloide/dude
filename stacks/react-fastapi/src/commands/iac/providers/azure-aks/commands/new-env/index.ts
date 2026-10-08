/** `dude iac new-env` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureNewEnv } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacNewEnvCommand = defineAzureNewEnv(azureAksTarget)
