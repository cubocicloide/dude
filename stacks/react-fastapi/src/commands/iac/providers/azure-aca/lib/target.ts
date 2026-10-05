/** What the shared Azure commands need to know about the Container Apps target. */
import type { AzureTarget } from '../../../azure/commands.js'
import { PROVIDER_ID, hasIac, requireIac } from './terraform.js'

export const azureAcaTarget: AzureTarget = {
  id: PROVIDER_ID,
  hasIac,
  requireIac,
  // No kubectl/helm/k9s: there is no cluster to talk to. The runner carries
  // terraform and the Azure CLI, which is the whole toolchain this target needs.
  shellTools: 'terraform, az',
  // No shellPrelude and no rewriteEnvTfvars: unlike the Kubernetes target there
  // is no cluster context to pin, and the public hostname is assigned by the
  // Container Apps environment rather than claimed from a DNS label that a new
  // environment would have to be given a distinct value for.
}
