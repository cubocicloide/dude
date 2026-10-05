/** `dude iac bootstrap` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureBootstrap } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacBootstrapCommand = defineAzureBootstrap(azureAksTarget)
