/**
 * `dude iac …` — Infrastructure-as-Code commands for the AWS EKS target.
 *
 * Present only when the project was scaffolded with `--iac aws-eks` (detected
 * by the presence of the `iac/` directory). Each command declares an
 * `available` predicate so `dude help` hides the whole group on non-IaC
 * projects, and guards again at runtime.
 *
 * Split of responsibilities (matches the scaffolded layout):
 *   - Terraform owns the infrastructure (VPC, EKS, ECR, optional RDS, ALB
 *     controller). `init/plan/apply/destroy/output/fmt/validate` wrap it.
 *   - Helm owns the application release. `deploy/status` wrap it.
 *   - `kubeconfig` wires kubectl to the provisioned cluster.
 *
 * Everything is environment-scoped via `--env` (default `dev`). State lives in
 * S3 + DynamoDB (see `iac/terraform/environments/<env>/backend.hcl`), so the
 * exact same commands work locally and in CI.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

const TF_DIR = path.join('iac', 'terraform')
const HELM_CHART = path.join('iac', 'helm', 'app')

// ── Project detection / guards ────────────────────────────────────────────────

/** True when the project was scaffolded with an IaC target (`iac/` present). */
function hasIac(projectRoot: string): boolean {
  return existsSync(path.join(projectRoot, 'iac', 'terraform'))
}

function requireIac(projectRoot: string): boolean {
  if (!hasIac(projectRoot)) {
    process.stderr.write(
      '\n  ✗  No IaC configuration found (iac/terraform).\n' +
        '     This project was not initialised with an IaC target.\n' +
        '     Re-scaffold with `--iac aws-eks` to enable it.\n\n',
    )
    return false
  }
  return true
}

// ── Small process helpers ─────────────────────────────────────────────────────

/** Run a command, inheriting stdio. Returns the exit status (or 1 on spawn error). */
function run(cmd: string, args: string[], cwd: string): number {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      process.stderr.write(`\n  ✗  \`${cmd}\` not found on PATH. Install it and retry.\n\n`)
    } else {
      process.stderr.write(`\n  ✗  failed to run ${cmd}: ${r.error.message}\n\n`)
    }
    return 1
  }
  return r.status ?? 1
}

/** Run a command and capture stdout (used for terraform output → kubeconfig). */
function capture(cmd: string, args: string[], cwd: string): { status: number; stdout: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  return { status: r.status ?? 1, stdout: r.stdout ?? '' }
}

/** Run terraform with the project's terraform dir as `-chdir`. */
function tf(projectRoot: string, args: string[]): number {
  return run('terraform', [`-chdir=${TF_DIR}`, ...args], projectRoot)
}

/** Resolve the `--env` flag (default `dev`). Rejects path-traversal values. */
function resolveEnv(args: Record<string, unknown>): string {
  const env = String(args.env ?? 'dev')
  if (!/^[a-z][a-z0-9-]*$/.test(env)) {
    process.stderr.write(`error: invalid --env "${env}" (expected lowercase kebab-case).\n`)
    process.exit(1)
  }
  return env
}

/** Read `projectName` from dude.json — used as the Helm release name. */
function projectName(projectRoot: string): string {
  try {
    const j = JSON.parse(readFileSync(path.join(projectRoot, 'dude.json'), 'utf8')) as {
      answers?: { projectName?: string }
    }
    return j.answers?.projectName ?? 'app'
  } catch {
    return 'app'
  }
}

function backendConfig(env: string): string {
  return `-backend-config=environments/${env}/backend.hcl`
}
function varFile(env: string): string {
  return `-var-file=environments/${env}/terraform.tfvars`
}

// ── Terraform commands ─────────────────────────────────────────────────────────

const envArg = {
  env: { type: 'string' as const, description: 'Target environment.', default: 'dev' },
}

export const iacInitCommand: StackCommandDef = {
  available: hasIac,
  description: 'Initialise Terraform for an environment (configures the S3 remote backend).',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = resolveEnv(args)
    process.exit(tf(projectRoot, ['init', backendConfig(env)]))
  },
}

export const iacPlanCommand: StackCommandDef = {
  available: hasIac,
  description: 'Show the infrastructure changes Terraform would apply for an environment.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = resolveEnv(args)
    process.exit(tf(projectRoot, ['plan', varFile(env)]))
  },
}

export const iacApplyCommand: StackCommandDef = {
  available: hasIac,
  description: 'Provision/update the infrastructure for an environment.',
  args: {
    ...envArg,
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = resolveEnv(args)
    const extra = args.yes ? ['-auto-approve'] : []
    process.exit(tf(projectRoot, ['apply', varFile(env), ...extra]))
  },
}

export const iacDestroyCommand: StackCommandDef = {
  available: hasIac,
  description: 'Destroy all infrastructure for an environment.',
  args: {
    ...envArg,
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = resolveEnv(args)
    const extra = args.yes ? ['-auto-approve'] : []
    process.exit(tf(projectRoot, ['destroy', varFile(env), ...extra]))
  },
}

export const iacOutputCommand: StackCommandDef = {
  available: hasIac,
  description: 'Print Terraform outputs for an environment (cluster name, ECR URLs, RDS endpoint…).',
  args: {
    ...envArg,
    json: { type: 'boolean', description: 'Emit machine-readable JSON.' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const extra = args.json ? ['-json'] : []
    process.exit(tf(projectRoot, ['output', ...extra]))
  },
}

export const iacFmtCommand: StackCommandDef = {
  available: hasIac,
  description: 'Format all Terraform files (terraform fmt -recursive).',
  async run({ projectRoot }) {
    if (!requireIac(projectRoot)) process.exit(1)
    process.exit(tf(projectRoot, ['fmt', '-recursive']))
  },
}

export const iacValidateCommand: StackCommandDef = {
  available: hasIac,
  description: 'Validate the Terraform configuration.',
  async run({ projectRoot }) {
    if (!requireIac(projectRoot)) process.exit(1)
    process.exit(tf(projectRoot, ['validate']))
  },
}

// ── Cluster access ──────────────────────────────────────────────────────────────

export const iacKubeconfigCommand: StackCommandDef = {
  available: hasIac,
  description: 'Update your kubeconfig to point at the provisioned EKS cluster.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    resolveEnv(args)
    // Pull cluster name + region from Terraform outputs.
    const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot)
    if (out.status !== 0) {
      process.stderr.write('error: could not read Terraform outputs — run `dude iac apply` first.\n')
      process.exit(1)
    }
    let cluster = ''
    let region = ''
    try {
      const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
      cluster = o.cluster_name?.value ?? ''
      region = o.region?.value ?? ''
    } catch {
      /* fall through to the error below */
    }
    if (!cluster || !region) {
      process.stderr.write('error: outputs `cluster_name`/`region` not found.\n')
      process.exit(1)
    }
    process.exit(
      run('aws', ['eks', 'update-kubeconfig', '--name', cluster, '--region', region], projectRoot),
    )
  },
}

// ── Application release (Helm) ────────────────────────────────────────────────

export const iacDeployCommand: StackCommandDef = {
  available: hasIac,
  description: 'Deploy the application to the cluster (helm upgrade --install).',
  args: {
    ...envArg,
    namespace: { type: 'string', description: 'Kubernetes namespace (default: the environment).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = resolveEnv(args)
    const ns = String(args.namespace ?? env)
    const release = projectName(projectRoot)
    process.exit(
      run(
        'helm',
        [
          'upgrade',
          '--install',
          release,
          HELM_CHART,
          '--namespace',
          ns,
          '--create-namespace',
          '--values',
          path.join(HELM_CHART, `values-${env}.yaml`),
        ],
        projectRoot,
      ),
    )
  },
}

export const iacStatusCommand: StackCommandDef = {
  available: hasIac,
  description: 'Show the deployed release status and pods.',
  args: {
    ...envArg,
    namespace: { type: 'string', description: 'Kubernetes namespace (default: the environment).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = resolveEnv(args)
    const ns = String(args.namespace ?? env)
    const release = projectName(projectRoot)
    const s = run('helm', ['status', release, '--namespace', ns], projectRoot)
    run('kubectl', ['get', 'pods', '--namespace', ns], projectRoot)
    process.exit(s)
  },
}
