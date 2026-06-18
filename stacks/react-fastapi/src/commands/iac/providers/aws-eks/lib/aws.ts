/** Raw AWS-CLI cleanup helpers used by `dude iac destroy`. */
import { capture, sleepMs, textTokens } from '../../../shared.js'

/**
 * Resource ARNs tagged by the AWS Load Balancer Controller for a given cluster.
 * The controller stamps every load balancer, target group and managed security
 * group with `elbv2.k8s.aws/cluster=<clusterName>`.
 */
export function findClusterTaggedArns(
  resourceType: string,
  clusterName: string,
  region: string,
  projectRoot: string,
  profile?: string,
): string[] {
  const r = capture(
    'aws',
    [
      'resourcegroupstaggingapi',
      'get-resources',
      '--resource-type-filters',
      resourceType,
      '--tag-filters',
      `Key=elbv2.k8s.aws/cluster,Values=${clusterName}`,
      '--query',
      'ResourceTagMappingList[*].ResourceARN',
      '--output',
      'text',
      ...(region ? ['--region', region] : []),
    ],
    projectRoot,
    profile,
  )
  return r.status === 0 ? textTokens(r.stdout) : []
}

/**
 * Delete the load balancers, target groups and security groups the AWS Load
 * Balancer Controller created for `clusterName`. The controller normally
 * removes these itself when the Ingress is deleted — but if the EKS cluster
 * (and thus the controller) is already gone, they are orphaned and block
 * `terraform destroy` of the VPC/subnets. We delete them directly, tolerating
 * "already deleted" at every step.
 *
 * Returns true when no controller-tagged resources remain afterwards.
 */
export function cleanupOrphanedAlbs(
  clusterName: string,
  region: string,
  projectRoot: string,
  profile?: string,
): boolean {
  const regionFlag = region ? ['--region', region] : []
  const find = (type: string) =>
    findClusterTaggedArns(type, clusterName, region, projectRoot, profile)

  // 1. Load balancers — delete and wait for AWS to actually remove each one
  //    (the attached ENIs must detach before their security groups can go).
  const albs = find('elasticloadbalancing:loadbalancer')
  for (const alb of albs) {
    process.stdout.write(`  → deleting load balancer ${alb.split('/').slice(-2).join('/')}…\n`)
    capture(
      'aws',
      ['elbv2', 'delete-load-balancer', '--load-balancer-arn', alb, ...regionFlag],
      projectRoot,
      profile,
    )
    capture(
      'aws',
      ['elbv2', 'wait', 'load-balancers-deleted', '--load-balancer-arns', alb, ...regionFlag],
      projectRoot,
      profile,
    )
  }

  // 2. Target groups — freed once their listeners (on the LB) are gone.
  for (const tg of find('elasticloadbalancing:targetgroup')) {
    capture(
      'aws',
      ['elbv2', 'delete-target-group', '--target-group-arn', tg, ...regionFlag],
      projectRoot,
      profile,
    )
  }

  // 3. Managed security groups. ENI detachment lags LB deletion and the SGs may
  //    reference one another, so retry a few times deleting whatever now frees up.
  const sgIds = find('ec2:security-group')
    .map((a) => a.split('/').pop() ?? '')
    .filter(Boolean)
  for (let attempt = 0; attempt < 6 && sgIds.length; attempt++) {
    if (attempt) sleepMs(10_000)
    for (let i = sgIds.length - 1; i >= 0; i--) {
      const sg = sgIds[i]!
      const r = capture(
        'aws',
        ['ec2', 'delete-security-group', '--group-id', sg, ...regionFlag],
        projectRoot,
        profile,
      )
      if (r.status === 0) {
        process.stdout.write(`  → deleted security group ${sg}\n`)
        sgIds.splice(i, 1)
      }
    }
  }
  if (sgIds.length) {
    process.stderr.write(
      `  ⚠  could not delete security groups: ${sgIds.join(', ')} — terraform destroy may still clear them.\n`,
    )
  }

  // Anything left tagged for the cluster?
  return (
    find('elasticloadbalancing:loadbalancer').length === 0 &&
    find('elasticloadbalancing:targetgroup').length === 0 &&
    sgIds.length === 0
  )
}

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
