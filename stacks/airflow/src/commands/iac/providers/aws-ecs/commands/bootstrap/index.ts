/** `dude iac bootstrap` — create the Terraform state backend (S3 + DynamoDB) + shared ECR. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import {
  TF_DIR,
  captureBootstrap,
  hasIac,
  requireEnv,
  requireIac,
  resolveProfile,
  tfBoot,
} from '../../lib/terraform.js'

export const iacBootstrapCommand: StackCommandDef = {
  available: hasIac,
  description:
    'One-time: create the S3 state bucket + DynamoDB lock table + shared ECR repository, then write the values into backend.hcl.',
  args: {
    region: {
      type: 'string',
      description: 'AWS region for the state resources.',
      default: 'eu-west-1',
    },
    'state-bucket-prefix': {
      type: 'string',
      description: 'Prefix for the S3 bucket name — must be globally unique (e.g. your org slug).',
      required: true,
    },
    env: { type: 'string', description: 'Environment whose backend.hcl to update (required).' },
    profile: {
      type: 'string',
      description: 'AWS profile to use (default: <project>-<env>, or $AWS_PROFILE).',
    },
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    const prefix = String(args['state-bucket-prefix'] ?? '')
    if (!prefix) {
      process.stderr.write(
        '\n  ✗  --state-bucket-prefix is required (e.g. your org slug, must be globally unique).\n\n',
      )
      process.exit(1)
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(prefix)) {
      process.stderr.write(
        `\n  ✗  invalid --state-bucket-prefix "${prefix}" (expected lowercase alphanumeric / hyphens).\n\n`,
      )
      process.exit(1)
    }

    const region = String(args.region ?? 'eu-west-1')
    if (!/^[a-z]{2}-[a-z]+-\d$/.test(region)) {
      process.stderr.write(`\n  ✗  invalid --region "${region}" (expected e.g. eu-west-1).\n\n`)
      process.exit(1)
    }

    const name = projectName(projectRoot)

    // 1. terraform init (bootstrap keeps local state — no -backend-config needed)
    let status = tfBoot(projectRoot, ['init', '-reconfigure'], profile)
    if (status !== 0) process.exit(status)

    // 2. terraform apply
    const extra = args.yes ? ['-auto-approve'] : []
    status = tfBoot(
      projectRoot,
      [
        'apply',
        `-var=project_name=${name}`,
        `-var=region=${region}`,
        `-var=state_bucket_prefix=${prefix}`,
        ...extra,
      ],
      profile,
    )
    if (status !== 0) process.exit(status)

    // 3. read outputs
    const out = captureBootstrap(projectRoot, ['output', '-json'], profile)
    if (out.status !== 0) {
      process.stderr.write('\n  ✗  Could not read bootstrap outputs.\n\n')
      process.exit(1)
    }
    let stateBucket = ''
    let lockTable = ''
    try {
      const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
      stateBucket = o.state_bucket?.value ?? ''
      lockTable = o.lock_table?.value ?? ''
    } catch {
      /* fall through to the guard below */
    }
    if (!stateBucket || !lockTable) {
      process.stderr.write('\n  ✗  Bootstrap outputs `state_bucket` / `lock_table` not found.\n\n')
      process.exit(1)
    }

    // 4. patch environments/<env>/backend.hcl in-place
    const backendHclPath = path.join(projectRoot, TF_DIR, 'environments', env, 'backend.hcl')
    try {
      let hcl = readFileSync(backendHclPath, 'utf8')
      hcl = hcl.replace(/^bucket\s*=\s*".*"$/m, `bucket         = "${stateBucket}"`)
      hcl = hcl.replace(/^dynamodb_table\s*=\s*".*"$/m, `dynamodb_table = "${lockTable}"`)
      writeFileSync(backendHclPath, hcl)
    } catch {
      process.stderr.write(`\n  ✗  Could not update ${backendHclPath}.\n\n`)
      process.exit(1)
    }

    process.stdout.write(
      `\n  ✓  Bootstrap complete.\n` +
        `     state_bucket:   ${stateBucket}\n` +
        `     lock_table:     ${lockTable}\n` +
        `     Updated:        iac/terraform/environments/${env}/backend.hcl\n\n` +
        `  Next: dude iac init --env ${env}\n\n`,
    )
  },
}
