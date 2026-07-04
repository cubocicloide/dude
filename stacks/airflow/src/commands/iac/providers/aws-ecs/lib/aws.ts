/** Raw AWS-CLI helpers used by `dude iac destroy` for the state-backend teardown. */
import { capture } from '../../../shared.js'

/**
 * Empty a versioned S3 bucket — delete every object version and delete marker —
 * so Terraform can then destroy the bucket. State buckets hold only a handful of
 * objects, but versioning means `aws s3 rm` alone leaves noncurrent versions
 * behind; we page through `list-object-versions` until nothing remains.
 */
export function emptyVersionedBucket(
  bucket: string,
  region: string,
  projectRoot: string,
  profile?: string,
): void {
  const regionFlag = region ? ['--region', region] : []
  for (let i = 0; i < 100; i++) {
    const list = capture(
      'aws',
      [
        's3api',
        'list-object-versions',
        '--bucket',
        bucket,
        '--max-items',
        '1000',
        '--query',
        '[Versions[].{Key:Key,VersionId:VersionId}, DeleteMarkers[].{Key:Key,VersionId:VersionId}][]',
        '--output',
        'json',
        ...regionFlag,
      ],
      projectRoot,
      profile,
    )
    if (list.status !== 0) return // bucket already gone or inaccessible
    let objects: Array<{ Key: string; VersionId: string }> = []
    try {
      objects = (JSON.parse(list.stdout) as typeof objects) ?? []
    } catch {
      return
    }
    if (!objects.length) return
    capture(
      'aws',
      [
        's3api',
        'delete-objects',
        '--bucket',
        bucket,
        '--delete',
        JSON.stringify({ Objects: objects.slice(0, 1000), Quiet: true }),
        ...regionFlag,
      ],
      projectRoot,
      profile,
    )
  }
}

/**
 * Whether an environment's Terraform remote state still describes live
 * infrastructure. After `terraform destroy` the state object stays in S3 but
 * with an empty `resources` array — so this, not the presence of the env's
 * folder on disk (which persists after a destroy), is the authoritative signal
 * for "is this env still provisioned". Returns `{ live, reason }` so the caller
 * can explain its backend-teardown decision. An unreadable-but-present state is
 * treated as live, so a transient read glitch never wipes a sibling's backend.
 */
export function envStateLiveness(
  bucket: string,
  key: string,
  region: string,
  projectRoot: string,
  profile?: string,
): { live: boolean; reason: string } {
  if (!bucket || !key) return { live: false, reason: 'no remote state configured' }
  const regionFlag = region ? ['--region', region] : []
  const r = capture('aws', ['s3', 'cp', `s3://${bucket}/${key}`, '-', ...regionFlag], projectRoot, profile)
  if (r.status !== 0) {
    return { live: false, reason: 'no state object (never applied, or already removed)' }
  }
  try {
    const state = JSON.parse(r.stdout) as { resources?: unknown[] }
    const n = Array.isArray(state.resources) ? state.resources.length : 0
    return n > 0
      ? { live: true, reason: `${n} resource(s) still in state` }
      : { live: false, reason: 'state is empty (already destroyed)' }
  } catch {
    return { live: true, reason: 'state present but unreadable — keeping to be safe' }
  }
}
