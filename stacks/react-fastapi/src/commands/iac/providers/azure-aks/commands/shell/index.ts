/** `dude iac shell` — shared across the Azure targets; see `iac/azure/commands.ts`. */
import { defineAzureShell } from '../../../../azure/commands.js'
import { azureAksTarget } from '../../lib/target.js'

export const iacShellCommand = defineAzureShell(azureAksTarget)
