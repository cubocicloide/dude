/**
 * Container Apps-specific Terraform plumbing. Everything generic to Azure —
 * remote state, environment discovery, subscription resolution — lives in
 * `iac/azure/` and is re-exported here so the commands have one import path.
 */
import { existsSync } from 'node:fs'
import path from 'pathe'
import { iacTarget, projectName } from '../../../shared.js'

export * from '../../../azure/terraform.js'

export const PROVIDER_ID = 'azure-aca'

/**
 * True when the project was scaffolded with the Azure Container Apps target.
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
      '\n  ✗  No Azure Container Apps IaC configuration found (iac/terraform).\n' +
        '     This project was not initialised with the azure-aca target.\n' +
        '     Re-scaffold with `--iac azure-aca` to enable it.\n\n',
    )
    return false
  }
  return true
}

/**
 * True when this project has a database, and therefore a migration job.
 *
 * Keyed off Alembic's config file rather than re-reading the `database` scaffold
 * answer, to match how the `dude db` commands gate themselves: the question both
 * are really asking is "did the scaffold produce migrations", and a project that
 * later removed them should stop offering the command either way.
 */
export function hasMigrations(projectRoot: string): boolean {
  return existsSync(path.join(projectRoot, 'backend', 'alembic.ini'))
}

/**
 * The resource group holding an environment, by scaffold convention. Used as a
 * fallback so `status`/`logs` still work when `terraform output` is unavailable
 * (state partially applied, or a command run before the first apply).
 */
export function resourceGroupFor(projectRoot: string, env: string): string {
  return `${projectName(projectRoot)}-${env}-rg`
}
