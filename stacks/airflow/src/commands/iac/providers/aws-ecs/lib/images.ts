/** ECR image build/push + ECS deploy helpers for the AWS ECS provider. */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import { childEnv } from '../../../shared.js'
import { capture, run } from './exec.js'
import { TF_DIR, tf, varFile } from './terraform.js'

/**
 * Deploy coordinates read from Terraform outputs. One image runs every Airflow
 * component (api-server, scheduler, dag-processor, triggerer, executor
 * workers) — DAGs, plugins and requirements are baked into it, so a deploy is
 * an immutable, atomic roll of the whole deployment.
 */
export interface EcsTarget {
  /** ECR repository URL for the Airflow image. */
  repository: string
  registryHost: string
  region: string
  cluster: string
  /** The web (api-server) ECS service — the one behind the ALB. */
  service: string
  /** Public Airflow UI endpoint, when the infra reports one. */
  airflowUrl?: string
}

export const tagArg = {
  tag: {
    type: 'string' as const,
    description: 'Image tag (default: git short SHA, with -dirty if uncommitted changes).',
  },
}

export const platformArg = {
  platform: {
    type: 'string' as const,
    description: 'Docker build platform (default linux/amd64, to match Fargate x86).',
  },
}

/**
 * Read the ECR repository URL + ECS coordinates from Terraform outputs. Returns
 * `null` when the outputs aren't available (infra not applied, no creds, …).
 */
export function readEcsTarget(projectRoot: string, profile?: string): EcsTarget | null {
  const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
  if (out.status !== 0) return null
  try {
    const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
    const repository = o.ecr_repository_url?.value ?? ''
    const region = o.region?.value ?? ''
    const cluster = o.cluster_name?.value ?? ''
    const service = o.service_name?.value ?? ''
    if (!repository || !region || !cluster || !service) return null
    return {
      repository,
      registryHost: repository.split('/')[0] ?? repository,
      region,
      cluster,
      service,
      airflowUrl: o.airflow_url?.value || undefined,
    }
  } catch {
    return null
  }
}

/** Resolve the target from Terraform outputs, printing the standard error on failure. */
export function requireEcsTarget(projectRoot: string, profile: string): EcsTarget {
  const target = readEcsTarget(projectRoot, profile)
  if (!target) {
    process.stderr.write(
      'error: could not read Terraform outputs (ecr_repository_url, cluster_name, …) — run `dude iac apply` first.\n',
    )
    process.exit(1)
  }
  return target
}

/**
 * Resolve the image tag. Precedence:
 *   1. an explicit `--tag` (validated as a Docker tag),
 *   2. the short git SHA of HEAD, suffixed with `-dirty` when the working tree
 *      has uncommitted changes (so an unreproducible build is never mistaken for
 *      a clean commit).
 * Returns `null` (after printing an error) when no tag can be derived.
 */
export function resolveTag(projectRoot: string, args: Record<string, unknown>): string | null {
  if (args.tag) {
    const t = String(args.tag)
    if (!/^[\w][\w.-]{0,127}$/.test(t)) {
      process.stderr.write(`\n  ✗  invalid --tag "${t}" (not a valid Docker tag).\n\n`)
      return null
    }
    return t
  }
  const sha = capture('git', ['rev-parse', '--short=12', 'HEAD'], projectRoot)
  if (sha.status !== 0 || !sha.stdout.trim()) {
    process.stderr.write(
      '\n  ✗  Could not derive a git SHA for the image tag.\n' +
        '     Pass --tag <tag>, or run inside a git repo with at least one commit.\n\n',
    )
    return null
  }
  let tag = sha.stdout.trim()
  const status = capture('git', ['status', '--porcelain'], projectRoot)
  if (status.status === 0 && status.stdout.trim() !== '') tag += '-dirty'
  return tag
}

/** `aws ecr get-login-password | docker login` without a shell pipe. */
export function dockerLogin(
  host: string,
  region: string,
  projectRoot: string,
  profile?: string,
): number {
  const pw = capture('aws', ['ecr', 'get-login-password', '--region', region], projectRoot, profile)
  if (pw.status !== 0 || !pw.stdout.trim()) {
    process.stderr.write('\n  ✗  Could not obtain an ECR login password (check your AWS auth).\n\n')
    return 1
  }
  const r = spawnSync('docker', ['login', '--username', 'AWS', '--password-stdin', host], {
    cwd: projectRoot,
    input: pw.stdout.trim(),
    stdio: ['pipe', 'inherit', 'inherit'],
    env: childEnv(profile),
  })
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code
    process.stderr.write(
      code === 'ENOENT'
        ? '\n  ✗  `docker` not found on PATH. Install it and retry.\n\n'
        : `\n  ✗  failed to run docker: ${r.error.message}\n\n`,
    )
    return 1
  }
  return r.status ?? 1
}

/**
 * Build the production image (DAGs + plugins + requirements baked in), tagged
 * for the shared ECR repository. Defaults to `linux/amd64` because Fargate
 * runs x86 by default — building on an arm64 laptop without this produces
 * images that crash with `exec format error`.
 */
export function doBuild(
  projectRoot: string,
  profile: string | undefined,
  tag: string,
  target: EcsTarget,
  platform: string,
): number {
  process.stdout.write(`\n  → building airflow  ${target.repository}:${tag} (${platform})\n`)
  return run(
    'docker',
    [
      'build',
      '--platform',
      platform,
      '-f',
      'airflow/Dockerfile.prod',
      '-t',
      `${target.repository}:${tag}`,
      'airflow',
    ],
    projectRoot,
    profile,
  )
}

/** Log in to ECR and push the Airflow image at `:tag`. */
export function doPush(
  projectRoot: string,
  profile: string | undefined,
  tag: string,
  target: EcsTarget,
): number {
  const code = dockerLogin(target.registryHost, target.region, projectRoot, profile)
  if (code !== 0) return code
  process.stdout.write(`\n  → pushing ${target.repository}:${tag}\n`)
  return run('docker', ['push', `${target.repository}:${tag}`], projectRoot, profile)
}

/**
 * Roll the ECS services onto `tag`: record it as `image_tag` in the env's
 * terraform.tfvars (so the file stays the source of truth for what the env
 * runs, and a plain `dude iac apply` never silently changes the deployed
 * version), then `terraform apply` — which registers new task-definition
 * revisions for the web, core, worker and migrate task definitions and lets
 * ECS roll the services with their circuit breakers armed.
 */
export function doDeploy(
  projectRoot: string,
  profile: string | undefined,
  env: string,
  tag: string,
  target: EcsTarget,
): number {
  const tfvarsPath = path.join(projectRoot, TF_DIR, 'environments', env, 'terraform.tfvars')
  try {
    let tfvars = readFileSync(tfvarsPath, 'utf8')
    if (/^\s*image_tag\s*=/m.test(tfvars)) {
      tfvars = tfvars.replace(/^(\s*image_tag\s*=\s*).*$/m, `$1"${tag}"`)
    } else {
      tfvars += `\nimage_tag = "${tag}"\n`
    }
    writeFileSync(tfvarsPath, tfvars)
  } catch {
    process.stderr.write(`\n  ✗  Could not update ${tfvarsPath}.\n\n`)
    return 1
  }

  process.stdout.write(`\n  → deploying ${target.repository}:${tag} to "${env}"…\n`)
  const code = tf(projectRoot, ['apply', varFile(env), '-auto-approve'], profile)
  if (code === 0) {
    process.stdout.write(
      `\n  ✓  Task definitions updated to :${tag} — ECS is rolling the services now\n` +
        `     (auto-rollback on failure). Watch them with: dude iac status --env ${env}\n` +
        (target.airflowUrl ? `     Airflow UI: ${target.airflowUrl}\n` : ''),
    )
  }
  return code
}
