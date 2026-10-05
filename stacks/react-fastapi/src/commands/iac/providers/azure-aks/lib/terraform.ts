/** Terraform / project plumbing for the Azure AKS provider. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { captureWith, hclScalar, iacTarget, projectName } from '../../../shared.js'
import { capture, run, type CaptureResult } from './exec.js'
import type { KubeTarget } from './runner.js'

export const PROVIDER_ID = 'azure-aks'

export const TF_DIR = path.join('iac', 'terraform')
export const TF_BOOTSTRAP_DIR = path.join(TF_DIR, 'bootstrap')
export const TF_ENVIRONMENTS_DIR = path.join(TF_DIR, 'environments')
export const HELM_CHART = path.join('iac', 'helm', 'app')

/** True when the project was scaffolded with the Azure AKS target. */
export function hasIac(projectRoot: string): boolean {
  return iacTarget(projectRoot) === PROVIDER_ID && existsSync(path.join(projectRoot, TF_DIR))
}

export function requireIac(projectRoot: string): boolean {
  if (!hasIac(projectRoot)) {
    process.stderr.write(
      '\n  ✗  No Azure IaC configuration found (iac/terraform).\n' +
        '     This project was not initialised with the azure-aks target.\n' +
        '     Re-scaffold with `--iac azure-aks` to enable it.\n\n',
    )
    return false
  }
  return true
}

/** Run terraform with the project's terraform dir as `-chdir`. */
export function tf(projectRoot: string, args: string[], subscription?: string): number {
  return run('terraform', [`-chdir=${TF_DIR}`, ...args], projectRoot, subscription)
}

/**
 * Read a single Terraform output as a raw scalar, returning '' when it isn't a
 * clean single token. `terraform output -raw` prints a "No outputs found"
 * warning into the output once state is empty/partly destroyed, so we only
 * trust values that look like one (no whitespace) — callers fall back to a
 * convention-derived value otherwise.
 */
export function tfOutputRaw(projectRoot: string, name: string, subscription?: string): string {
  const r = capture(
    'terraform',
    [`-chdir=${TF_DIR}`, 'output', '-raw', name],
    projectRoot,
    subscription,
  )
  const value = r.stdout.trim()
  return r.status === 0 && value && !/\s/.test(value) ? value : ''
}

export function backendConfig(env: string): string {
  return `-backend-config=environments/${env}/backend.hcl`
}
export function varFile(env: string): string {
  return `-var-file=environments/${env}/terraform.tfvars`
}

/** Run terraform inside the bootstrap sub-directory (local state, no remote backend). */
export function tfBoot(projectRoot: string, args: string[], subscription?: string): number {
  return run('terraform', args, path.join(projectRoot, TF_BOOTSTRAP_DIR), subscription)
}

/** Capture terraform output from the bootstrap sub-directory. */
export function captureBootstrap(
  projectRoot: string,
  args: string[],
  subscription?: string,
): CaptureResult {
  return capture('terraform', args, path.join(projectRoot, TF_BOOTSTRAP_DIR), subscription)
}

/**
 * Resolve the Azure subscription for an environment. Precedence:
 *   1. an explicit `--subscription` flag,
 *   2. `subscription_id` pinned in the environment's terraform.tfvars,
 *   3. an already-exported ARM_SUBSCRIPTION_ID / AZURE_SUBSCRIPTION_ID,
 *   4. whatever `az account show` reports as the signed-in default.
 *
 * Unlike the AWS provider's profile — which is a local alias and can always be
 * derived from a naming convention — a subscription id is a cloud-side GUID that
 * cannot be guessed, so step 4 asks the CLI rather than inventing one. Returns
 * '' when nothing resolves; callers then let the tool report the auth problem
 * itself rather than second-guessing it.
 */
export function resolveSubscription(
  projectRoot: string,
  args: Record<string, unknown>,
  env: string,
): string {
  if (args.subscription) return String(args.subscription)
  const pinned = tfvarsValue(projectRoot, env, 'subscription_id')
  if (pinned) return pinned
  const exported = process.env.ARM_SUBSCRIPTION_ID || process.env.AZURE_SUBSCRIPTION_ID
  if (exported) return exported
  // `az` is deliberately invoked without a subscription scope here: this IS the
  // call that discovers one. It also runs natively (never through the runner) so
  // the lookup can't recurse into image-building.
  const r = captureWith(
    'az',
    ['account', 'show', '--query', 'id', '--output', 'tsv'],
    projectRoot,
    process.env,
  )
  return r.status === 0 ? r.stdout.trim() : ''
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

/** Read a quoted scalar from an environment's terraform.tfvars (best-effort). */
export function tfvarsValue(projectRoot: string, env: string, key: string): string {
  try {
    return hclScalar(
      readFileSync(path.join(projectRoot, TF_DIR, 'environments', env, 'terraform.tfvars'), 'utf8'),
      key,
    )
  } catch {
    return ''
  }
}

/**
 * The remote-state backend coordinates for an environment, read from its
 * `backend.hcl`. This is the authoritative source for the storage account /
 * container names — `terraform output` can't be trusted here because it returns
 * *nothing* once any output references an already-destroyed resource.
 */
export function readBackend(
  projectRoot: string,
  env: string,
): { resourceGroup: string; storageAccount: string; container: string; key: string } {
  try {
    const txt = readFileSync(
      path.join(projectRoot, TF_DIR, 'environments', env, 'backend.hcl'),
      'utf8',
    )
    return {
      resourceGroup: hclScalar(txt, 'resource_group_name'),
      storageAccount: hclScalar(txt, 'storage_account_name'),
      container: hclScalar(txt, 'container_name'),
      key: hclScalar(txt, 'key'),
    }
  } catch {
    return { resourceGroup: '', storageAccount: '', container: '', key: '' }
  }
}

export const envArg = {
  env: {
    type: 'string' as const,
    description: 'Target environment (required) — one of iac/terraform/environments/*.',
  },
  subscription: {
    type: 'string' as const,
    description:
      'Azure subscription id (default: subscription_id in the env tfvars, $ARM_SUBSCRIPTION_ID, or your az default).',
  },
}

/**
 * Discover the environments defined on disk: each subdirectory of
 * `iac/terraform/environments/` that carries both a `backend.hcl` and a
 * `terraform.tfvars` (the two files that make an environment usable). Returned
 * sorted; `[]` when none / the folder is missing.
 */
export function listEnvironments(projectRoot: string): string[] {
  const base = path.join(projectRoot, TF_ENVIRONMENTS_DIR)
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter(
        (name) =>
          existsSync(path.join(base, name, 'backend.hcl')) &&
          existsSync(path.join(base, name, 'terraform.tfvars')),
      )
      .sort()
  } catch {
    return []
  }
}

/**
 * Resolve and validate `--env` against the environments discovered on disk.
 * There is intentionally NO default: every IaC command targets exactly one
 * environment, and silently assuming `dev` invites running plan/apply/destroy
 * against the wrong one. Exits with a helpful message (available envs + how to
 * create one) when `--env` is missing or names a non-existent environment.
 */
export function requireEnv(projectRoot: string, args: Record<string, unknown>): string {
  const envs = listEnvironments(projectRoot)
  const available = envs.length ? envs.join(', ') : '(none — create one first)'
  const raw = args.env == null ? '' : String(args.env)

  if (!raw) {
    process.stderr.write(
      `\n  ✗  --env is required.\n` +
        `     Available environments: ${available}\n` +
        `     Create a new one with:  dude iac new-env --env <name>\n\n`,
    )
    process.exit(1)
  }
  if (!/^[a-z][a-z0-9-]*$/.test(raw)) {
    process.stderr.write(`\n  ✗  invalid --env "${raw}" (expected lowercase kebab-case).\n\n`)
    process.exit(1)
  }
  if (!envs.includes(raw)) {
    process.stderr.write(
      `\n  ✗  environment "${raw}" does not exist.\n` +
        `     An environment is a folder iac/terraform/environments/<name>/ with a\n` +
        `     backend.hcl and a terraform.tfvars. Available: ${available}\n` +
        `     Create it with:  dude iac new-env --env ${raw}\n\n`,
    )
    process.exit(1)
  }
  return raw
}
