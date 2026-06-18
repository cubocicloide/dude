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
 * Delete dangling (status `available`) network interfaces left in the cluster's
 * VPC. The AWS VPC CNI sometimes orphans secondary ENIs (`aws-K8S-*`) when the
 * node group is torn down abruptly; while detached, they still occupy a subnet
 * and reference the node security group, so `terraform destroy` then fails with
 * `DeleteSubnet`/`DeleteSecurityGroup … DependencyViolation`. We locate the VPC
 * by its `Project`/`Environment` default tags (every env resource carries them)
 * and delete only ENIs that are already detached, so this is always safe.
 *
 * Returns the number of interfaces removed.
 */
export function releaseClusterVpcEnis(
  project: string,
  env: string,
  region: string,
  projectRoot: string,
  profile?: string,
): number {
  const regionFlag = region ? ['--region', region] : []
  const vpc = capture(
    'aws',
    [
      'ec2',
      'describe-vpcs',
      '--filters',
      `Name=tag:Project,Values=${project}`,
      `Name=tag:Environment,Values=${env}`,
      '--query',
      'Vpcs[0].VpcId',
      '--output',
      'text',
      ...regionFlag,
    ],
    projectRoot,
    profile,
  )
  const vpcId = vpc.status === 0 ? vpc.stdout.trim() : ''
  if (!vpcId || vpcId === 'None') return 0

  const enis = capture(
    'aws',
    [
      'ec2',
      'describe-network-interfaces',
      '--filters',
      `Name=vpc-id,Values=${vpcId}`,
      'Name=status,Values=available',
      '--query',
      'NetworkInterfaces[].NetworkInterfaceId',
      '--output',
      'text',
      ...regionFlag,
    ],
    projectRoot,
    profile,
  )
  let removed = 0
  for (const id of enis.status === 0 ? textTokens(enis.stdout) : []) {
    const r = capture(
      'aws',
      ['ec2', 'delete-network-interface', '--network-interface-id', id, ...regionFlag],
      projectRoot,
      profile,
    )
    if (r.status === 0) {
      process.stdout.write(`  → deleted dangling network interface ${id}\n`)
      removed++
    }
  }
  return removed
}

/**
 * Delete the Route53 records external-dns created for an environment, identified
 * by its TXT-registry owner id (`<project>-<env>`). external-dns runs
 * `--policy=upsert-only`, so it never removes records itself; without this a
 * destroyed env orphans its A record (still pointing at the now-deleted ALB →
 * NXDOMAIN) and a TXT ownership marker that blocks the next deploy from taking
 * the hostname over. We delete by submitting the exact record sets back with
 * `Action=DELETE`.
 *
 * Returns the number of record sets removed; 0 (no-op) when the zone can't be
 * found or nothing is owned by this id.
 */
export function cleanupExternalDnsRecords(
  zoneName: string,
  ownerId: string,
  projectRoot: string,
  profile?: string,
): number {
  if (!zoneName || !ownerId) return 0
  const fqdn = zoneName.endsWith('.') ? zoneName : `${zoneName}.`

  const zid = capture(
    'aws',
    [
      'route53',
      'list-hosted-zones-by-name',
      '--dns-name',
      fqdn,
      '--query',
      `HostedZones[?Name=='${fqdn}'].Id | [0]`,
      '--output',
      'text',
    ],
    projectRoot,
    profile,
  )
  const zoneId = zid.status === 0 ? zid.stdout.trim() : ''
  if (!zoneId || zoneId === 'None') return 0

  const list = capture(
    'aws',
    [
      'route53',
      'list-resource-record-sets',
      '--hosted-zone-id',
      zoneId,
      '--max-items',
      '1000',
      '--output',
      'json',
    ],
    projectRoot,
    profile,
  )
  if (list.status !== 0) return 0

  interface RecordSet {
    Name: string
    Type: string
    TTL?: number
    ResourceRecords?: Array<{ Value?: string }>
    AliasTarget?: unknown
    SetIdentifier?: string
  }
  let sets: RecordSet[] = []
  try {
    sets = (JSON.parse(list.stdout) as { ResourceRecordSets?: RecordSet[] }).ResourceRecordSets ?? []
  } catch {
    return 0
  }

  // Pass 1: find the TXT registry records that carry our owner id, then recover
  // the managed name each one guards. external-dns names a guard TXT either
  // identically to the managed record (`dev.zone.`) or with a type prefix
  // (`a-dev.zone.`, `cname-dev.zone.`); strip a leading type label to map back.
  const owned = `external-dns/owner=${ownerId}`
  const managedNames = new Set<string>()
  const toDelete: RecordSet[] = []
  for (const rs of sets) {
    if (rs.Type !== 'TXT') continue
    if (!(rs.ResourceRecords ?? []).some((r) => (r.Value ?? '').includes(owned))) continue
    toDelete.push(rs)
    managedNames.add(rs.Name.replace(/^(a|aaaa|cname|txt)-/, ''))
  }
  if (!managedNames.size) return 0

  // Pass 2: the actual A/AAAA/CNAME records those TXTs guard.
  for (const rs of sets) {
    if (rs.Type !== 'TXT' && managedNames.has(rs.Name)) toDelete.push(rs)
  }

  // DELETE requires the exact current record set — echo back what we read.
  const changes = toDelete.map((rs) => {
    const set: Record<string, unknown> = { Name: rs.Name, Type: rs.Type }
    if (rs.SetIdentifier) set.SetIdentifier = rs.SetIdentifier
    if (rs.AliasTarget) {
      set.AliasTarget = rs.AliasTarget
    } else {
      set.TTL = rs.TTL
      set.ResourceRecords = rs.ResourceRecords
    }
    return { Action: 'DELETE', ResourceRecordSet: set }
  })
  const r = capture(
    'aws',
    [
      'route53',
      'change-resource-record-sets',
      '--hosted-zone-id',
      zoneId,
      '--change-batch',
      JSON.stringify({ Changes: changes }),
    ],
    projectRoot,
    profile,
  )
  return r.status === 0 ? toDelete.length : 0
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
