/** `dude iac push` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzurePush } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacPushCommand = defineAzurePush(azureAksTarget)
