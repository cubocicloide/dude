/** `dude iac bootstrap` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureBootstrap } from '../../../../azure/commands.js'
import { azureAcaTarget } from '../../lib/target.js'

export const iacBootstrapCommand = defineAzureBootstrap(azureAcaTarget)
