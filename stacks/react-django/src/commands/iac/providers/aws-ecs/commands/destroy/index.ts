/**
 * `dude iac destroy` — tear down everything for an environment.
 *
 * Unlike the EKS story there is nothing outside Terraform's control here (the
 * ALB, target group and ECS service are all Terraform-managed), so the per-env
 * teardown is a plain `terraform destroy`. The shared bootstrap — the state
 * backend (S3 + DynamoDB) and the ECR repository — lives outside the per-env
 * Terraform and is torn down last, and only when no sibling environment still
 * uses it.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture } from '../../../../shared.js'
import { emptyVersionedBucket, envStateLiveness } from '../../lib/aws.js'
import {
  envArg,
  hasIac,
  listEnvironments,
  readBackend,
  requireEnv,
  requireIac,
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
    'Tear down everything for an environment: destroy the Terraform infrastructure, then empty + destroy the state backend (S3 bucket + DynamoDB table) and the shared ECR repository. Use --keep-backend to preserve the shared bootstrap.',
  args: {
    ...envArg,
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
    'keep-backend': {
      type: 'boolean',
      description:
        'Keep the shared bootstrap (S3 state bucket + DynamoDB lock table + ECR repository). It is kept automatically while any other environment still uses the same bucket; pass this to force-keep it even when destroying the last environment.',
    },
    'skip-tf': {
      type: 'boolean',
      description:
        'Skip the Terraform destroy of the environment — only run the backend teardown (unless --keep-backend).',
    },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const extra = args.yes ? ['-auto-approve'] : []

    const region =
      tfOutputRaw(projectRoot, 'region', profile) || tfvarsValue(projectRoot, env, 'region')

    // ── Step 1: destroy the environment's Terraform infrastructure ───────────
    if (!args['skip-tf']) {
      const code = tf(projectRoot, ['destroy', varFile(env), ...extra], profile)
      if (code !== 0) process.exit(code)
    }

    // ── Step 2: tear down the shared bootstrap (S3 + DynamoDB + ECR) ─────────
    // By default we tear it down too (the common "destroy everything" case);
    // pass --keep-backend when other environments still rely on it. The bucket
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
    // state backend (S3 bucket + DynamoDB lock table) AND the ECR repository —
    // used by every environment (they differ only by their state `key`). Tearing
    // the bootstrap down would wipe the OTHER envs' state and delete the registry
    // they still deploy from, so if any sibling env is STILL PROVISIONED we keep
    // the bootstrap and stop.
    //
    // Liveness is read from each sibling's remote *state* — NOT from the presence
    // of its folder on disk: a folder (backend.hcl + terraform.tfvars) survives a
    // `terraform destroy`, so a disk-based check would see an already-torn-down
    // `staging` and refuse to ever tear the backend down. The state object, by
    // contrast, is empty (`resources: []`) once the env is destroyed. (Per-env
    // `terraform destroy` above never touches ECR — it isn't in the per-env
    // state — so destroying one env here is always safe for the shared registry.)
    if (stateBucket) {
      const siblings = listEnvironments(projectRoot).filter(
        (e) => e !== env && readBackend(projectRoot, e).bucket === stateBucket,
      )
      const live: string[] = []
      if (siblings.length) {
        process.stdout.write(`  → checking sibling environments on this backend…\n`)
        for (const e of siblings) {
          const b = readBackend(projectRoot, e)
          const { live: isLive, reason } = envStateLiveness(
            b.bucket,
            b.key,
            b.region || region,
            projectRoot,
            profile,
          )
          process.stdout.write(`     • ${e}: ${isLive ? 'still live' : 'not live'} — ${reason}\n`)
          if (isLive) live.push(e)
        }
      }
      if (live.length) {
        process.stdout.write(
          `\n  ↷  Keeping the shared backend + ECR — still used by: ${live.join(', ')}.\n` +
            `     Destroying it would wipe their state and registry. Destroy those\n` +
            `     environments first, or pass --keep-backend. Done.\n\n`,
        )
        process.exit(0)
      }
    }

    process.stdout.write(
      `\n  → tearing down the shared bootstrap (S3 + DynamoDB + ECR)…\n` +
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
