/**
 * `dude iac destroy` — tear down everything for an environment.
 *
 * Order matters: the ALB and its security groups are created by the in-cluster
 * AWS Load Balancer Controller (not by Terraform) and hold references into the
 * VPC, so they must be removed before `terraform destroy`. The state backend
 * (S3 + DynamoDB) lives outside the per-env Terraform and is torn down last.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, projectName, run } from '../../../../shared.js'
import { cleanupOrphanedAlbs, emptyVersionedBucket } from '../../lib/aws.js'
import {
  envArg,
  hasIac,
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
    'Tear down everything for an environment: uninstall the Helm release, delete the ALB / target groups / security groups the controller left behind, destroy the Terraform infrastructure, then empty + destroy the state backend (S3 bucket + DynamoDB table). Use --keep-backend to preserve the shared state backend.',
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
        'Keep the Terraform state backend (S3 bucket + DynamoDB lock table). Use this when other environments still share it; by default destroy also tears the backend down.',
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

    // ── Step 3: destroy the environment's Terraform infrastructure ───────────
    if (!args['skip-tf']) {
      const code = tf(projectRoot, ['destroy', varFile(env), ...extra], profile)
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
