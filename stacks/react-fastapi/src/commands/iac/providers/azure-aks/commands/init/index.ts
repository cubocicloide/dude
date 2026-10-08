/** `dude iac init` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureInit } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacInitCommand = defineAzureInit(azureAksTarget)
