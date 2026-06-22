/** Terraform / project plumbing for the AWS EKS provider. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { hclScalar, projectName } from '../../../shared.js'
import { capture, run, type CaptureResult } from './exec.js'

export const TF_DIR = path.join('iac', 'terraform')
export const TF_BOOTSTRAP_DIR = path.join(TF_DIR, 'bootstrap')
export const TF_ENVIRONMENTS_DIR = path.join(TF_DIR, 'environments')
export const HELM_CHART = path.join('iac', 'helm', 'app')

/** True when the project was scaffolded with the AWS EKS target (`iac/terraform` present). */
export function hasIac(projectRoot: string): boolean {
  return existsSync(path.join(projectRoot, 'iac', 'terraform'))
}

export function requireIac(projectRoot: string): boolean {
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

/** Run terraform with the project's terraform dir as `-chdir`. */
export function tf(projectRoot: string, args: string[], profile?: string): number {
  return run('terraform', [`-chdir=${TF_DIR}`, ...args], projectRoot, profile)
}

/**
 * Read a single Terraform output as a raw scalar, returning '' when it isn't a
 * clean single token. `terraform output -raw` prints a "No outputs found"
 * warning into the output once state is empty/partly destroyed, so we only
 * trust values that look like one (no whitespace) — callers fall back to a
 * convention-derived value otherwise.
 */
export function tfOutputRaw(projectRoot: string, name: string, profile?: string): string {
  const r = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-raw', name], projectRoot, profile)
  const value = r.stdout.trim()
  return r.status === 0 && value && !/\s/.test(value) ? value : ''
}

export function backendConfig(env: string): string {
  return `-backend-config=environments/${env}/backend.hcl`
}
export function varFile(env: string): string {
  return `-var-file=environments/${env}/terraform.tfvars`
}

/** Run terraform inside the bootstrap sub-directory (local state, no remote backend). */
export function tfBoot(projectRoot: string, args: string[], profile?: string): number {
  return run('terraform', args, path.join(projectRoot, TF_BOOTSTRAP_DIR), profile)
}

/** Capture terraform output from the bootstrap sub-directory. */
export function captureBootstrap(
  projectRoot: string,
  args: string[],
  profile?: string,
): CaptureResult {
  return capture('terraform', args, path.join(projectRoot, TF_BOOTSTRAP_DIR), profile)
}

/**
 * Resolve the AWS profile for an environment. Precedence:
 *   1. an explicit `--profile` flag,
 *   2. an already-exported `AWS_PROFILE`,
 *   3. the convention `<projectName>-<env>`.
 */
export function resolveProfile(
  projectRoot: string,
  args: Record<string, unknown>,
  env: string,
): string {
  if (args.profile) return String(args.profile)
  if (process.env.AWS_PROFILE) return process.env.AWS_PROFILE
  return `${projectName(projectRoot)}-${env}`
}

/** Read a quoted scalar from an environment's terraform.tfvars (best-effort). */
export function tfvarsValue(projectRoot: string, env: string, key: string): string {
  try {
    return hclScalar(
      readFileSync(path.join(projectRoot, TF_DIR, 'environments', env, 'terraform.tfvars'), 'utf8'),
      key,
    )
  } catch {
    return ''
  }
}

/**
 * The remote-state backend coordinates for an environment, read from its
 * `backend.hcl`. This is the authoritative source for the state bucket / lock
 * table names — `terraform output` can't be trusted here because it returns
 * *nothing* once any output references an already-destroyed resource.
 */
export function readBackend(
  projectRoot: string,
  env: string,
): { bucket: string; table: string; region: string } {
  try {
    const txt = readFileSync(
      path.join(projectRoot, TF_DIR, 'environments', env, 'backend.hcl'),
      'utf8',
    )
    return {
      bucket: hclScalar(txt, 'bucket'),
      table: hclScalar(txt, 'dynamodb_table'),
      region: hclScalar(txt, 'region'),
    }
  } catch {
    return { bucket: '', table: '', region: '' }
  }
}

export const envArg = {
  env: {
    type: 'string' as const,
    description: 'Target environment (required) — one of iac/terraform/environments/*.',
  },
  profile: {
    type: 'string' as const,
    description: 'AWS profile to use (default: <project>-<env>, or $AWS_PROFILE).',
  },
}

/**
 * Discover the environments defined on disk: each subdirectory of
 * `iac/terraform/environments/` that carries both a `backend.hcl` and a
 * `terraform.tfvars` (the two files that make an environment usable). Returned
 * sorted; `[]` when none / the folder is missing.
 */
export function listEnvironments(projectRoot: string): string[] {
  const base = path.join(projectRoot, TF_ENVIRONMENTS_DIR)
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter(
        (name) =>
          existsSync(path.join(base, name, 'backend.hcl')) &&
          existsSync(path.join(base, name, 'terraform.tfvars')),
      )
      .sort()
  } catch {
    return []
  }
}

/**
 * Resolve and validate `--env` against the environments discovered on disk.
 * There is intentionally NO default: every IaC command targets exactly one
 * environment, and silently assuming `dev` invites running plan/apply/destroy
 * against the wrong one. Exits with a helpful message (available envs + how to
 * create one) when `--env` is missing or names a non-existent environment.
 */
export function requireEnv(projectRoot: string, args: Record<string, unknown>): string {
  const envs = listEnvironments(projectRoot)
  const available = envs.length ? envs.join(', ') : '(none — create one first)'
  const raw = args.env == null ? '' : String(args.env)

  if (!raw) {
    process.stderr.write(
      `\n  ✗  --env is required.\n` +
        `     Available environments: ${available}\n` +
        `     Create a new one with:  dude iac new-env --env <name>\n\n`,
    )
    process.exit(1)
  }
  if (!/^[a-z][a-z0-9-]*$/.test(raw)) {
    process.stderr.write(`\n  ✗  invalid --env "${raw}" (expected lowercase kebab-case).\n\n`)
    process.exit(1)
  }
  if (!envs.includes(raw)) {
    process.stderr.write(
      `\n  ✗  environment "${raw}" does not exist.\n` +
        `     An environment is a folder iac/terraform/environments/<name>/ with a\n` +
        `     backend.hcl and a terraform.tfvars. Available: ${available}\n` +
        `     Create it with:  dude iac new-env --env ${raw}\n\n`,
    )
    process.exit(1)
  }
  return raw
}
