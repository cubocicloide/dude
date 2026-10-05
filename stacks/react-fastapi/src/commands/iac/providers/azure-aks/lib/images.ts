/**
 * Releasing the application on AKS: a Helm upgrade.
 *
 * Everything about *producing* the images — reading the registry out of
 * Terraform, logging in, building, pushing, resolving the tag — is shared with
 * the other Azure targets and re-exported here so the commands have one import
 * path. Only `doDeploy` is specific to Kubernetes.
 */
import { existsSync } from 'node:fs'
import path from 'pathe'
import { projectName } from '../../../shared.js'
import { run } from './exec.js'
import { HELM_CHART, kubeTarget, tfOutputs } from './terraform.js'
import type { AcrRepos } from '../../../azure/acr.js'

export * from '../../../azure/acr.js'

/**
 * The Terraform-derived values the Helm release needs beyond the registry: the
 * public hostname Azure assigned, and the database connection string. They are
 * read here rather than carried on `AcrRepos` because they are release inputs,
 * not registry facts.
 */
interface ReleaseExtras {
  host?: string
  databaseUrl?: string
}

function readReleaseExtras(projectRoot: string, subscription?: string): ReleaseExtras {
  const o = tfOutputs(projectRoot, subscription)
  if (!o) return {}
  const str = (k: string): string | undefined => {
    const v = o[k]?.value
    return typeof v === 'string' && v ? v : undefined
  }
  return { host: str('app_host'), databaseUrl: str('database_url') }
}

/**
 * `helm upgrade --install`, wiring the registry, image tag and public hostname
 * from Terraform outputs so the user never has to hand-edit them into
 * values-<env>.yaml. The env values file (resources, secrets, …) is still
 * layered when present.
 */
export function doDeploy(
  projectRoot: string,
  subscription: string | undefined,
  env: string,
  ns: string,
  tag: string,
  repos: AcrRepos,
): number {
  const helmArgs = [
    'upgrade',
    '--install',
    projectName(projectRoot),
    HELM_CHART,
    '--namespace',
    ns,
    '--create-namespace',
  ]
  const valuesFile = path.join(HELM_CHART, `values-${env}.yaml`)
  if (existsSync(path.join(projectRoot, valuesFile))) helmArgs.push('--values', valuesFile)
  helmArgs.push(
    '--set',
    `image.registry=${repos.registryHost}`,
    '--set',
    `image.backend.tag=${tag}`,
    '--set',
    `image.frontend.tag=${tag}`,
  )
  const extras = readReleaseExtras(projectRoot, subscription)
  // The Azure-assigned hostname (<dns-label>.<region>.cloudapp.azure.com) is only
  // known after apply, so it is wired here rather than committed into values.yaml.
  if (extras.host) helmArgs.push('--set', `ingress.host=${extras.host}`)
  // Wire the DB connection string straight from Terraform (no Key Vault).
  // --set-string avoids type coercion; the password is alphanumeric (special=false
  // in Terraform) so there are no commas/`=` to confuse helm's --set parser. This
  // takes precedence over anything in the (gitignored) values-<env>.yaml.
  if (extras.databaseUrl) helmArgs.push('--set-string', `secrets.DATABASE_URL=${extras.databaseUrl}`)
  return run('helm', helmArgs, projectRoot, subscription, kubeTarget(projectRoot, env, ns))
}
