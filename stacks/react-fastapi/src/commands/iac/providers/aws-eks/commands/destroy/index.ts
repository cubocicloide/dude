/**
 * `dude iac destroy` — tear down everything for an environment.
 *
 * Order matters: the ALB and its security groups are created by the in-cluster
 * AWS Load Balancer Controller (not by Terraform) and hold references into the
 * VPC, so they must be removed before `terraform destroy`. The state backend
 * (S3 + DynamoDB) lives outside the per-env Terraform and is torn down last.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import { capture, run } from '../../lib/exec.js'
import {
  cleanupExternalDnsRecords,
  cleanupOrphanedAlbs,
  emptyVersionedBucket,
  releaseClusterVpcEnis,
} from '../../lib/aws.js'
import {
  envArg,
  hasIac,
  listEnvironments,
  readBackend,
  requireEnv, requireIac,
  resolveProfile,
  tf,
  tfBoot,
  tfOutputRaw,
  tfvarsValue,
  varFile,
} from '../../lib/terraform.js'

export const iacDestroyCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Tear down everything for an environment: uninstall the Helm release, delete the ALB / target groups / security groups the controller left behind, remove the Route53 records external-dns created, destroy the Terraform infrastructure, then empty + destroy the state backend (S3 bucket + DynamoDB table). Use --keep-backend to preserve the shared state backend.',
  args: {
    ...envArg,
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
    namespace: {
      type: 'string',
      description: 'Kubernetes namespace the release lives in (default: the environment).',
    },
    'skip-helm': {
      type: 'boolean',
      description: 'Skip the Helm uninstall step — use when the release is already gone.',
    },
    'keep-backend': {
      type: 'boolean',
      description:
        'Keep the Terraform state backend (S3 bucket + DynamoDB lock table). It is kept automatically while any other environment still uses the same bucket; pass this to force-keep it even when destroying the last environment.',
    },
    'skip-tf': {
      type: 'boolean',
      description:
        'Skip the Terraform destroy of the environment — only run the Helm/ALB cleanup (and the backend teardown unless --keep-backend).',
    },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const ns = String(args.namespace ?? env)
    const release = projectName(projectRoot)
    const extra = args.yes ? ['-auto-approve'] : []

    // ── Step 1: uninstall the Helm release ───────────────────────────────────
    if (!args['skip-helm']) {
      const helmCheck = capture('helm', ['status', release, '--namespace', ns], projectRoot, profile)
      if (helmCheck.status === 0) {
        process.stdout.write(`\n  → uninstalling Helm release "${release}" from namespace "${ns}"…\n`)
        const code = run('helm', ['uninstall', release, '--namespace', ns], projectRoot, profile)
        if (code !== 0) {
          process.stderr.write(
            '\n  ✗  Helm uninstall failed. Retry or re-run with --skip-helm if you removed it manually.\n\n',
          )
          process.exit(code)
        }
        // Wait for the Ingress to disappear — confirms the ALB controller has
        // started deleting the AWS ALB (--for=delete exits 0 when already gone).
        process.stdout.write('  → waiting for the Ingress to be removed…\n')
        run(
          'kubectl',
          ['wait', '--for=delete', `ingress/${release}`, '--namespace', ns, '--timeout=3m'],
          projectRoot,
          profile,
        )
      } else {
        process.stdout.write(
          `  ↷  Helm release "${release}" not found in namespace "${ns}", skipping uninstall.\n`,
        )
      }
    }

    // ── Step 2: remove the AWS Load Balancer Controller's resources ──────────
    // The controller cleans them up when the Ingress is removed, but only while
    // it's still running; if the cluster is already partly gone there's no
    // controller left and they're orphaned forever. We delete them directly
    // (idempotent), deriving the cluster name from the convention so it works
    // even with an empty state.
    const clusterName =
      tfOutputRaw(projectRoot, 'cluster_name', profile) || `${projectName(projectRoot)}-${env}`
    const region =
      tfOutputRaw(projectRoot, 'region', profile) || tfvarsValue(projectRoot, env, 'region')

    process.stdout.write(
      `  → cleaning up load-balancer resources tagged for cluster "${clusterName}"…\n`,
    )
    const clean = cleanupOrphanedAlbs(clusterName, region, projectRoot, profile)
    if (clean) {
      process.stdout.write('  ✓  No lingering load-balancer resources. Proceeding with destroy.\n\n')
    } else {
      process.stderr.write(
        '  ⚠  Some load-balancer resources could not be removed — proceeding anyway.\n' +
          '     If terraform destroy fails on a subnet/SG dependency, delete the leftover\n' +
          '     ALB/security group from the AWS console and re-run with --skip-helm.\n\n',
      )
    }

    // ── Step 2.5: remove the Route53 records external-dns left behind ─────────
    // external-dns runs upsert-only (it never deletes), so without this a torn-
    // down env orphans its A record — still pointing at the now-deleted ALB
    // (→ NXDOMAIN) — plus a TXT ownership marker that stops the next deploy from
    // reusing the hostname. We delete via the AWS API (no cluster needed), keyed
    // by the env's external-dns owner id (`<project>-<env>`).
    const zoneName = tfvarsValue(projectRoot, env, 'route53_zone_name')
    if (zoneName) {
      const ownerId = `${release}-${env}`
      process.stdout.write(`  → removing Route53 records owned by external-dns ("${ownerId}")…\n`)
      const removed = cleanupExternalDnsRecords(zoneName, ownerId, projectRoot, profile)
      process.stdout.write(
        removed > 0
          ? `  ✓  Removed ${removed} DNS record(s).\n\n`
          : '  ↷  No external-dns records to remove.\n\n',
      )
    }

    // ── Step 3: destroy the environment's Terraform infrastructure ───────────
    if (!args['skip-tf']) {
      let code = tf(projectRoot, ['destroy', varFile(env), ...extra], profile)
      if (code !== 0) {
        // A first destroy commonly fails on `DeleteVpc … DependencyViolation`:
        // the AWS Load Balancer Controller's shared security groups (e.g.
        // `k8s-traffic-*`, the node "backend-sg") are attached to the node ENIs,
        // so the step-2 cleanup can't remove them while the nodes still exist —
        // and Terraform doesn't manage them, so it can't either. Now that this
        // destroy has torn the node group/cluster down, the SGs are free: re-run
        // the cleanup (it'll delete them) and retry the destroy once.
        process.stderr.write(
          '\n  ⚠  terraform destroy failed — likely leftover Kubernetes networking blocking\n' +
            '     the VPC (a load-balancer security group, or a dangling CNI network\n' +
            '     interface). Cleaning those up and retrying…\n\n',
        )
        releaseClusterVpcEnis(projectName(projectRoot), env, region, projectRoot, profile)
        cleanupOrphanedAlbs(clusterName, region, projectRoot, profile)
        code = tf(projectRoot, ['destroy', varFile(env), ...extra], profile)
      }
      if (code !== 0) process.exit(code)
    }

    // ── Step 4: tear down the shared state backend (S3 + DynamoDB) ───────────
    // By default we tear them down too (the common "destroy everything" case);
    // pass --keep-backend when other environments still rely on them. The bucket
    // is versioned, so we empty it before destroying.
    if (args['keep-backend']) {
      process.stdout.write('  ↷  Keeping the Terraform state backend (--keep-backend). Done.\n\n')
      process.exit(0)
    }

    // Names come from backend.hcl, not `terraform output` (which returns nothing
    // once an output references an already-destroyed resource).
    const backend = readBackend(projectRoot, env)
    const stateBucket = backend.bucket
    const lockTable = backend.table
    const backendRegion = backend.region || region
    if (!stateBucket && !lockTable) {
      process.stdout.write('  ↷  No state backend configured to tear down. Done.\n\n')
      process.exit(0)
    }

    // Safety guard: the bootstrap owns the project-wide SHARED resources — the
    // state backend (S3 bucket + DynamoDB lock table) AND the ECR repositories —
    // used by every environment (they differ only by their state `key`). Tearing
    // the bootstrap down would wipe the OTHER envs' state and delete the registry
    // they still deploy from, so if any sibling env still points at this bucket
    // we keep the bootstrap and stop. Tear those envs down first, or pass
    // --keep-backend to skip this teardown. (Per-env `terraform destroy` above
    // never touches ECR — it isn't in the per-env state — so destroying one env
    // here is always safe for the shared registry.)
    if (stateBucket) {
      const sharedWith = listEnvironments(projectRoot).filter(
        (e) => e !== env && readBackend(projectRoot, e).bucket === stateBucket,
      )
      if (sharedWith.length) {
        process.stdout.write(
          `  ↷  Keeping the shared backend + ECR — bucket "${stateBucket}" is still\n` +
            `     used by: ${sharedWith.join(', ')}. Destroying it would wipe their state\n` +
            `     and registry. Destroy those environments first, or pass --keep-backend. Done.\n\n`,
        )
        process.exit(0)
      }
    }

    process.stdout.write(
      `\n  → tearing down the Terraform state backend (S3 + DynamoDB)…\n` +
        `     bucket: ${stateBucket || '(none)'}   lock table: ${lockTable || '(none)'}\n`,
    )
    if (stateBucket) {
      process.stdout.write(`  → emptying state bucket ${stateBucket}…\n`)
      emptyVersionedBucket(stateBucket, backendRegion, projectRoot, profile)
    }
    // Bootstrap keeps local state — make sure it's initialised, then destroy.
    tfBoot(projectRoot, ['init', '-input=false'], profile)
    const bootCode = tfBoot(projectRoot, ['destroy', ...extra], profile)

    // Belt-and-suspenders: if Terraform couldn't remove them (e.g. its local
    // state drifted from reality), delete the bucket/table directly so the
    // teardown actually completes. Both calls tolerate "already gone".
    const regionFlag = backendRegion ? ['--region', backendRegion] : []
    if (stateBucket) {
      emptyVersionedBucket(stateBucket, backendRegion, projectRoot, profile)
      capture('aws', ['s3api', 'delete-bucket', '--bucket', stateBucket, ...regionFlag], projectRoot, profile)
    }
    if (lockTable) {
      capture('aws', ['dynamodb', 'delete-table', '--table-name', lockTable, ...regionFlag], projectRoot, profile)
    }

    // Confirm both are actually gone before reporting success.
    const bucketGone =
      !stateBucket ||
      capture('aws', ['s3api', 'head-bucket', '--bucket', stateBucket, ...regionFlag], projectRoot, profile)
        .status !== 0
    const tableGone =
      !lockTable ||
      capture('aws', ['dynamodb', 'describe-table', '--table-name', lockTable, ...regionFlag], projectRoot, profile)
        .status !== 0
    if (bucketGone && tableGone) {
      process.stdout.write('  ✓  State backend removed.\n\n')
      process.exit(0)
    }
    process.stderr.write(
      '  ✗  Some state-backend resources could not be removed. Check the AWS console:\n' +
        (bucketGone ? '' : `     S3 bucket:     ${stateBucket}\n`) +
        (tableGone ? '' : `     DynamoDB table: ${lockTable}\n\n`),
    )
    process.exit(bootCode || 1)
  },
}
