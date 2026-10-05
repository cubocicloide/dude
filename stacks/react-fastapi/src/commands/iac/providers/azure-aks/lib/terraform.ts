/**
 * AKS-specific Terraform plumbing. Everything generic to Azure — remote state,
 * environment discovery, subscription resolution — lives in `iac/azure/` and is
 * re-exported here so the commands have one import path.
 */
import { existsSync } from 'node:fs'
import path from 'pathe'
import { iacTarget, projectName } from '../../../shared.js'
import { tfvarsValue } from '../../../azure/terraform.js'
import type { KubeTarget } from './runner.js'

export * from '../../../azure/terraform.js'

export const PROVIDER_ID = 'azure-aks'

export const HELM_CHART = path.join('iac', 'helm', 'app')

/**
 * True when the project was scaffolded with the Azure AKS target.
 *
 * Keyed off the recorded scaffold answer, not the presence of `iac/terraform`:
 * every provider scaffolds into that same path, so a presence check would claim
 * projects belonging to the other targets and hand them the wrong commands.
 */
export function hasIac(projectRoot: string): boolean {
  return (
    iacTarget(projectRoot) === PROVIDER_ID &&
    existsSync(path.join(projectRoot, 'iac', 'terraform'))
  )
}

export function requireIac(projectRoot: string): boolean {
  if (!hasIac(projectRoot)) {
    process.stderr.write(
      '\n  ✗  No Azure AKS IaC configuration found (iac/terraform).\n' +
        '     This project was not initialised with the azure-aks target.\n' +
        '     Re-scaffold with `--iac azure-aks` to enable it.\n\n',
    )
    return false
  }
  return true
}

/**
 * The cluster a containerized kube tool should target for an environment, by
 * scaffold convention: cluster `<project>-<env>` in resource group
 * `<project>-<env>-rg`, namespace as given. Pass the result as the `kube` arg of
 * `run`/`capture` so kubectl/helm hit this exact cluster instead of whatever the
 * host's current-context happens to be. A wrong/empty value degrades to the
 * mounted ~/.kube rather than silently acting on the wrong cluster.
 */
export function kubeTarget(projectRoot: string, env: string, namespace: string): KubeTarget {
  return {
    cluster: `${projectName(projectRoot)}-${env}`,
    resourceGroup: `${projectName(projectRoot)}-${env}-rg`,
    namespace,
  }
}

// Re-exported so the AKS commands keep importing everything from one module.
export { tfvarsValue }
