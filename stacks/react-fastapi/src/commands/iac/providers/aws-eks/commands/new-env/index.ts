/** `dude iac new-env` — scaffold a new environment by copying an existing one. */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import {
  HELM_CHART,
  TF_ENVIRONMENTS_DIR,
  hasIac,
  listEnvironments,
  requireIac,
} from '../../lib/terraform.js'

export const iacNewEnvCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Scaffold a new environment (iac/terraform/environments/<name>) by copying an existing one.',
  args: {
    env: {
      type: 'string',
      description: 'Name of the new environment to create (lowercase kebab-case).',
      required: true,
    },
    from: {
      type: 'string',
      description: 'Existing environment to copy as a starting point (default: dev).',
    },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)

    const name = args.env == null ? '' : String(args.env)
    if (!name) {
      process.stderr.write('\n  ✗  --env is required (the name of the environment to create).\n\n')
      process.exit(1)
    }
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      process.stderr.write(`\n  ✗  invalid --env "${name}" (expected lowercase kebab-case).\n\n`)
      process.exit(1)
    }

    const envs = listEnvironments(projectRoot)
    if (envs.includes(name)) {
      process.stderr.write(`\n  ✗  environment "${name}" already exists.\n\n`)
      process.exit(1)
    }
    if (!envs.length) {
      process.stderr.write(
        '\n  ✗  no existing environment to copy from (expected at least iac/terraform/environments/dev).\n\n',
      )
      process.exit(1)
    }

    const from = args.from == null ? 'dev' : String(args.from)
    if (!envs.includes(from)) {
      process.stderr.write(`\n  ✗  --from "${from}" does not exist. Available: ${envs.join(', ')}\n\n`)
      process.exit(1)
    }

    const base = path.join(projectRoot, TF_ENVIRONMENTS_DIR)
    const dst = path.join(base, name)
    cpSync(path.join(base, from), dst, { recursive: true })

    // Point terraform.tfvars at the new environment.
    const tfvarsPath = path.join(dst, 'terraform.tfvars')
    writeFileSync(
      tfvarsPath,
      readFileSync(tfvarsPath, 'utf8').replace(/^(\s*environment\s*=\s*).*$/m, `$1"${name}"`),
    )

    // Reuse the same S3 bucket + lock table (the state backend is shared across
    // environments); only the state key differs per environment.
    const backendPath = path.join(dst, 'backend.hcl')
    writeFileSync(
      backendPath,
      readFileSync(backendPath, 'utf8').replace(
        /^(\s*key\s*=\s*).*$/m,
        `$1"${projectName(projectRoot)}/${name}/terraform.tfstate"`,
      ),
    )

    // Carry over the per-env Helm values too (replicas, config, secrets). The file
    // is gitignored and optional at deploy time, but copying it makes new-env
    // scaffold a *complete* environment — otherwise the new env would silently
    // deploy with the base values.yaml defaults instead of <from>'s overrides.
    // Only when the source env actually has one on disk (it may not after a clone).
    const fromValues = path.join(projectRoot, HELM_CHART, `values-${from}.yaml`)
    const copiedValues = existsSync(fromValues)
    if (copiedValues) {
      cpSync(fromValues, path.join(projectRoot, HELM_CHART, `values-${name}.yaml`))
    }

    const valuesLine = copiedValues
      ? `     ${HELM_CHART}/values-${name}.yaml (per-env Helm overrides + secrets — gitignored)\n`
      : `     (no ${HELM_CHART}/values-${from}.yaml on disk — the new env will use the base\n` +
        `      values.yaml; create ${HELM_CHART}/values-${name}.yaml for per-env overrides)\n`

    process.stdout.write(
      `\n  ✓  Created environment "${name}" (copied from "${from}").\n` +
        `     iac/terraform/environments/${name}/{backend.hcl,terraform.tfvars}\n` +
        valuesLine +
        `\n  Next:\n` +
        `     1. Review iac/terraform/environments/${name}/terraform.tfvars (sizing, domain, …)` +
        (copiedValues ? ` and\n        ${HELM_CHART}/values-${name}.yaml (replicas, secrets, …).\n` : `.\n`) +
        `     2. First env on a brand-new state backend? Run:\n` +
        `        dude iac bootstrap --env ${name} --state-bucket-prefix <prefix>\n` +
        `        Otherwise it reuses the existing bucket — skip bootstrap.\n` +
        `     3. dude iac init --env ${name} && dude iac apply --env ${name}\n\n`,
    )
  },
}
