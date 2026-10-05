/** What the shared Azure commands need to know about the AKS target. */
import { projectName } from '../../../shared.js'
import type { AzureTarget } from '../../../azure/commands.js'
import { PROVIDER_ID, hasIac, requireIac } from './terraform.js'
import { kubePrelude } from './runner.js'

export const azureAksTarget: AzureTarget = {
  id: PROVIDER_ID,
  hasIac,
  requireIac,
  shellTools: 'terraform, kubectl, helm, k9s, az',

  // `dns_label` names the Azure-assigned public hostname. Left at the source
  // env's value, a new environment would either collide with it or quietly
  // serve on the old environment's URL.
  rewriteEnvTfvars: (tfvars, env, project) =>
    tfvars.replace(/^(\s*dns_label\s*=\s*).*$/m, `$1"${project}-${env}"`),

  // Open the shell with kubectl/helm/k9s already pointed at this env's cluster,
  // so it never inherits whatever context the host happened to be on.
  shellPrelude: (projectRoot, env) =>
    kubePrelude(
      {
        cluster: `${projectName(projectRoot)}-${env}`,
        resourceGroup: `${projectName(projectRoot)}-${env}-rg`,
        namespace: env,
      },
      true,
    ),
}
