/** `dude iac fmt` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureFmt } from '../../../../azure/commands.js'
import { azureAcaTarget } from '../../lib/target.js'

export const iacFmtCommand = defineAzureFmt(azureAcaTarget)
