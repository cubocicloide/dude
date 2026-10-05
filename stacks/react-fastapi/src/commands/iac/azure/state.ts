/** Raw Azure-CLI helpers shared by the Azure providers' `destroy`. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'pathe'
import { capture } from './exec.js'
import { TF_BOOTSTRAP_DIR } from './terraform.js'

/**
 * Whether an environment's Terraform remote state still describes live
 * infrastructure. After `terraform destroy` the state blob stays in the storage
 * account but with an empty `resources` array — so this, not the presence of the
 * env's folder on disk (which persists after a destroy), is the authoritative
 * signal for "is this env still provisioned". Returns `{ live, reason }` so the
 * caller can explain its backend-teardown decision. An unreadable-but-present
 * state is treated as live, so a transient read glitch never wipes a sibling's
 * backend.
 *
 * `az storage blob download` has no "write to stdout" mode that survives being
 * captured, so the blob goes to a temp file we read and delete.
 */
export function envStateLiveness(
  storageAccount: string,
  container: string,
  key: string,
  projectRoot: string,
  subscription?: string,
): { live: boolean; reason: string } {
  if (!storageAccount || !container || !key) {
    return { live: false, reason: 'no remote state configured' }
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dude-tfstate-'))
  const file = path.join(dir, 'state.json')
  try {
    const r = capture(
      'az',
      [
        'storage',
        'blob',
        'download',
        '--account-name',
        storageAccount,
        '--container-name',
        container,
        '--name',
        key,
        // Key auth, matching the Terraform backend: `login` would additionally
        // require the data-plane role "Storage Blob Data Contributor", which
        // subscription Owners do not get automatically — and this read decides
        // whether a sibling environment is still alive, so a permissions 403
        // here would be read as "no state blob" and could wave through a
        // teardown of state another environment still needs.
        '--auth-mode',
        'key',
        '--file',
        file,
        '--no-progress',
        '--output',
        'none',
      ],
      projectRoot,
      subscription,
    )
    if (r.status !== 0) {
      return { live: false, reason: 'no state blob (never applied, or already removed)' }
    }
    const state = JSON.parse(readFileSync(file, 'utf8')) as { resources?: unknown[] }
    const n = Array.isArray(state.resources) ? state.resources.length : 0
    return n > 0
      ? { live: true, reason: `${n} resource(s) still in state` }
      : { live: false, reason: 'state is empty (already destroyed)' }
  } catch {
    return { live: true, reason: 'state present but unreadable — keeping to be safe' }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * True when a resource group still exists in the subscription. Used after
 * `terraform destroy` to confirm the teardown actually landed: Terraform
 * reporting success while the group lingers (a delete still in flight, a
 * resource with a lock) is the case worth telling the user about, because the
 * meter keeps running.
 */
export function resourceGroupExists(
  name: string,
  projectRoot: string,
  subscription?: string,
): boolean {
  if (!name) return false
  const r = capture(
    'az',
    ['group', 'exists', '--name', name, '--output', 'tsv'],
    projectRoot,
    subscription,
  )
  return r.status === 0 && r.stdout.trim() === 'true'
}

/**
 * True when the bootstrap's Terraform state describes nothing — so a
 * `terraform destroy` there will report success having removed nothing, while
 * the real storage account and registry carry on existing.
 *
 * This happens more easily than it should: the bootstrap deliberately keeps
 * LOCAL state (it is what creates the remote backend, so it cannot use it), and
 * `iac/.gitignore` excludes `*.tfstate`. The file therefore lives only in the
 * working directory of whoever ran `dude iac bootstrap` — a fresh clone, a
 * re-scaffold or a different teammate all arrive with an empty state and no way
 * to tear the shared resources down through Terraform.
 */
export function bootstrapStateIsEmpty(projectRoot: string): boolean {
  const file = path.join(projectRoot, TF_BOOTSTRAP_DIR, 'terraform.tfstate')
  if (!existsSync(file)) return true
  try {
    const state = JSON.parse(readFileSync(file, 'utf8')) as { resources?: unknown[] }
    return !Array.isArray(state.resources) || state.resources.length === 0
  } catch {
    return false // unreadable: assume it holds something, and let Terraform decide
  }
}
