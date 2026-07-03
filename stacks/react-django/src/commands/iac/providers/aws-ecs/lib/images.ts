/** ECR image build/push + ECS deploy helpers for the AWS ECS provider. */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import { childEnv } from '../../../shared.js'
import { capture, run } from './exec.js'
import { TF_DIR, tf, varFile } from './terraform.js'

/** One deployable image: where it builds from and where it pushes to. */
export interface ImageSpec {
  /** Human label used in progress output. */
  name: 'backend' | 'frontend'
  /** ECR repository URL for this image. */
  repository: string
  /** Dockerfile path relative to the project root. */
  dockerfile: string
  /** Build context relative to the project root. */
  context: string
}

/** Deploy coordinates read from Terraform outputs. */
export interface EcsTarget {
  images: ImageSpec[]
  registryHost: string
  region: string
  cluster: string
  backendService: string
  frontendService: string
  /** Public app URL, when the infra reports one. */
  appUrl?: string
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
 * Read the ECR repository URLs + ECS coordinates from Terraform outputs.
 * Returns `null` when the outputs aren't available (infra not applied, no
 * creds, …).
 */
export function readEcsTarget(projectRoot: string, profile?: string): EcsTarget | null {
  const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
  if (out.status !== 0) return null
  try {
    const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
    const backendRepo = o.ecr_backend_repository_url?.value ?? ''
    const frontendRepo = o.ecr_frontend_repository_url?.value ?? ''
    const region = o.region?.value ?? ''
    const cluster = o.cluster_name?.value ?? ''
    const backendService = o.backend_service_name?.value ?? ''
    const frontendService = o.frontend_service_name?.value ?? ''
    if (!backendRepo || !frontendRepo || !region || !cluster || !backendService) return null
    return {
      images: [
        {
          name: 'backend',
          repository: backendRepo,
          dockerfile: 'backend/Dockerfile.prod',
          context: 'backend',
        },
        {
          name: 'frontend',
          repository: frontendRepo,
          dockerfile: 'frontend/Dockerfile.prod',
          context: 'frontend',
        },
      ],
      registryHost: backendRepo.split('/')[0] ?? backendRepo,
      region,
      cluster,
      backendService,
      frontendService,
      appUrl: o.app_url?.value || undefined,
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
      'error: could not read Terraform outputs (ecr_backend_repository_url, cluster_name, …) — run `dude iac apply` first.\n',
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
 * Build both production images (backend + frontend), tagged for their shared
 * ECR repositories. Defaults to `linux/amd64` because Fargate runs x86 by
 * default — building on an arm64 laptop without this produces images that
 * crash with `exec format error`.
 */
export function doBuild(
  projectRoot: string,
  profile: string | undefined,
  tag: string,
  target: EcsTarget,
  platform: string,
): number {
  for (const image of target.images) {
    process.stdout.write(`\n  → building ${image.name}  ${image.repository}:${tag} (${platform})\n`)
    const code = run(
      'docker',
      [
        'build',
        '--platform',
        platform,
        '-f',
        image.dockerfile,
        '-t',
        `${image.repository}:${tag}`,
        image.context,
      ],
      projectRoot,
      profile,
    )
    if (code !== 0) return code
  }
  return 0
}

/** Log in to ECR and push both images at `:tag`. */
export function doPush(
  projectRoot: string,
  profile: string | undefined,
  tag: string,
  target: EcsTarget,
): number {
  const code = dockerLogin(target.registryHost, target.region, projectRoot, profile)
  if (code !== 0) return code
  for (const image of target.images) {
    process.stdout.write(`\n  → pushing ${image.repository}:${tag}\n`)
    const pushCode = run('docker', ['push', `${image.repository}:${tag}`], projectRoot, profile)
    if (pushCode !== 0) return pushCode
  }
  return 0
}

/**
 * Roll the ECS services onto `tag`: record it as `image_tag` in the env's
 * terraform.tfvars (so the file stays the source of truth for what the env
 * runs, and a plain `dude iac apply` never silently changes the deployed
 * version), then `terraform apply` — which registers new task definition
 * revisions and lets ECS roll both services with their circuit breakers armed.
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

  process.stdout.write(`\n  → deploying :${tag} to "${env}"…\n`)
  const code = tf(projectRoot, ['apply', varFile(env), '-auto-approve'], profile)
  if (code === 0) {
    process.stdout.write(
      `\n  ✓  Task definitions updated to :${tag} — ECS is rolling the services now\n` +
        `     (auto-rollback on failure). Watch them with: dude iac status --env ${env}\n` +
        `     Remember to apply pending Django migrations: dude iac migrate --env ${env}\n` +
        (target.appUrl ? `     App URL: ${target.appUrl}\n` : ''),
    )
  }
  return code
}
