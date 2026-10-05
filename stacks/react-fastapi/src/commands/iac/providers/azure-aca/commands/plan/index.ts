/** `dude iac plan` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzurePlan } from '../../../../azure/commands.js'
import { azureAcaTarget } from '../../lib/target.js'

export const iacPlanCommand = defineAzurePlan(azureAcaTarget)
