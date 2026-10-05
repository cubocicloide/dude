/** `dude iac build` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureBuild } from '../../../../azure/commands.js'
import { azureAcaTarget } from '../../lib/target.js'

export const iacBuildCommand = defineAzureBuild(azureAcaTarget)
