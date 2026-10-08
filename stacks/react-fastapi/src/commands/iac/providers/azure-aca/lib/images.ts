/**
 * Releasing the application on Container Apps: recording the image tag in the
 * environment's tfvars and letting Terraform roll it out.
 *
 * Everything about *producing* the images is shared with the other Azure targets
 * and re-exported here so the commands have one import path. Only `doDeploy` is
 * specific — and it is deliberately declarative: the running image tag is a
 * committed input in `terraform.tfvars`, not a state Terraform would otherwise
 * see drift away on every deploy. The alternative, `az containerapp update
 * --image`, would leave the next `terraform apply` quietly reverting production
 * to whatever tag the file still said.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import { TF_DIR, tf, varFile } from './terraform.js'
import type { AcrRepos } from '../../../azure/acr.js'

export * from '../../../azure/acr.js'

/** Write `image_tag` into the environment's tfvars, adding the line if absent. */
export function recordImageTag(projectRoot: string, env: string, tag: string): boolean {
  const tfvarsPath = path.join(projectRoot, TF_DIR, 'environments', env, 'terraform.tfvars')
  try {
    let tfvars = readFileSync(tfvarsPath, 'utf8')
    if (/^\s*image_tag\s*=/m.test(tfvars)) {
      tfvars = tfvars.replace(/^(\s*image_tag\s*=\s*).*$/m, `$1"${tag}"`)
    } else {
      tfvars += `\nimage_tag = "${tag}"\n`
    }
    writeFileSync(tfvarsPath, tfvars)
    return true
  } catch {
    process.stderr.write(`\n  ✗  Could not update ${tfvarsPath}.\n\n`)
    return false
  }
}

/**
 * Roll every container app in the environment onto `tag` by recording it and
 * applying. Container Apps creates a new revision per app and shifts traffic to
 * it once it passes its probes, so this is a rolling release, not a restart.
 */
export function doDeploy(
  projectRoot: string,
  subscription: string | undefined,
  env: string,
  tag: string,
  repos: AcrRepos,
): number {
  if (!recordImageTag(projectRoot, env, tag)) return 1

  process.stdout.write(`\n  → deploying :${tag} to "${env}"…\n`)
  const code = tf(projectRoot, ['apply', varFile(env), '-auto-approve'], subscription)
  if (code === 0) {
    process.stdout.write(
      `\n  ✓  Container apps rolled onto :${tag}.\n` +
        `     Watch them with: dude iac status --env ${env}\n` +
        (repos.appUrl ? `     App URL: ${repos.appUrl}\n` : ''),
    )
  }
  return code
}
