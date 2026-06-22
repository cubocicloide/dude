/** ECR image build/push + Helm deploy helpers for the AWS EKS provider. */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import { childEnv, projectName } from '../../../shared.js'
import { capture, run } from './exec.js'
import { HELM_CHART, TF_DIR } from './terraform.js'

/** ECR coordinates read from Terraform outputs. */
export interface EcrRepos {
  backend: string
  frontend: string
  registryHost: string
  region: string
  /** ACM certificate ARN for the app domain, when TLS is configured in Terraform. */
  certificateArn?: string
  /** Public hostname the app is served on, when a domain is configured. */
  domain?: string
  /** Full PostgreSQL connection string, when a managed database is provisioned. */
  databaseUrl?: string
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
    description: 'Docker build platform (default linux/amd64, to match EKS x86 nodes).',
  },
}

/**
 * Read the ECR repository URLs + region from Terraform outputs. Returns `null`
 * when the outputs aren't available (infra not applied, no creds, …). The TLS
 * outputs (acm_certificate_arn, app_domain) are optional — present only when a
 * domain was configured.
 */
export function readEcrRepos(projectRoot: string, profile?: string): EcrRepos | null {
  const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
  if (out.status !== 0) return null
  try {
    const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
    const backend = o.ecr_backend_repository_url?.value ?? ''
    const frontend = o.ecr_frontend_repository_url?.value ?? ''
    const region = o.region?.value ?? ''
    if (!backend || !frontend || !region) return null
    return {
      backend,
      frontend,
      registryHost: backend.split('/')[0] ?? backend,
      region,
      certificateArn: o.acm_certificate_arn?.value || undefined,
      domain: o.app_domain?.value || undefined,
      databaseUrl: o.database_url?.value || undefined,
    }
  } catch {
    return null
  }
}

/** Resolve repos from Terraform outputs, printing the standard error on failure. */
export function requireEcrRepos(projectRoot: string, profile: string): EcrRepos {
  const repos = readEcrRepos(projectRoot, profile)
  if (!repos) {
    process.stderr.write(
      'error: could not read Terraform outputs (ecr_*_repository_url) — run `dude iac apply` first.\n',
    )
    process.exit(1)
  }
  return repos
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
 * Build both production images, tagged for the env's ECR repositories.
 * Defaults to `linux/amd64` because EKS managed nodes are x86 — building on an
 * arm64 laptop without this produces images that crash with `exec format error`.
 */
export function doBuild(
  projectRoot: string,
  profile: string | undefined,
  tag: string,
  repos: EcrRepos,
  project: string,
  platform: string,
): number {
  process.stdout.write(`\n  → building backend  ${repos.backend}:${tag} (${platform})\n`)
  let code = run(
    'docker',
    ['build', '--platform', platform, '-f', 'backend/Dockerfile.prod', '-t', `${repos.backend}:${tag}`, 'backend'],
    projectRoot,
    profile,
  )
  if (code !== 0) return code
  process.stdout.write(`\n  → building frontend ${repos.frontend}:${tag} (${platform})\n`)
  code = run(
    'docker',
    [
      'build',
      '--platform',
      platform,
      '-f',
      'frontend/Dockerfile.prod',
      '--build-arg',
      `VITE_APP_TITLE=${project}`,
      '-t',
      `${repos.frontend}:${tag}`,
      'frontend',
    ],
    projectRoot,
    profile,
  )
  return code
}

/** Log in to ECR and push both images at `:tag`. */
export function doPush(
  projectRoot: string,
  profile: string | undefined,
  tag: string,
  repos: EcrRepos,
): number {
  let code = dockerLogin(repos.registryHost, repos.region, projectRoot, profile)
  if (code !== 0) return code
  process.stdout.write(`\n  → pushing ${repos.backend}:${tag}\n`)
  code = run('docker', ['push', `${repos.backend}:${tag}`], projectRoot, profile)
  if (code !== 0) return code
  process.stdout.write(`\n  → pushing ${repos.frontend}:${tag}\n`)
  return run('docker', ['push', `${repos.frontend}:${tag}`], projectRoot, profile)
}

/**
 * `helm upgrade --install`, wiring the registry + image tag from outputs/git so
 * the user never has to hand-edit them into values-<env>.yaml. When the infra
 * has a domain configured, the ACM cert ARN + host are wired too, so the ALB
 * serves HTTPS (redirecting HTTP→443). The env values file (resources, secrets,
 * …) is still layered when present.
 */
export function doDeploy(
  projectRoot: string,
  profile: string | undefined,
  env: string,
  ns: string,
  tag: string,
  repos: EcrRepos,
): number {
  const helmArgs = [
    'upgrade',
    '--install',
    projectName(projectRoot),
    HELM_CHART,
    '--namespace',
    ns,
    '--create-namespace',
  ]
  const valuesFile = path.join(HELM_CHART, `values-${env}.yaml`)
  if (existsSync(path.join(projectRoot, valuesFile))) helmArgs.push('--values', valuesFile)
  helmArgs.push(
    '--set',
    `image.registry=${repos.registryHost}`,
    '--set',
    `image.backend.tag=${tag}`,
    '--set',
    `image.frontend.tag=${tag}`,
  )
  if (repos.certificateArn) {
    helmArgs.push('--set', `ingress.certificateArn=${repos.certificateArn}`)
  }
  if (repos.domain) {
    helmArgs.push('--set', `ingress.host=${repos.domain}`)
  }
  // Wire the DB connection string straight from Terraform (no Secrets Manager).
  // --set-string avoids type coercion; the password is alphanumeric (special=false
  // in Terraform) so there are no commas/`=` to confuse helm's --set parser. This
  // takes precedence over anything in the (gitignored) values-<env>.yaml.
  if (repos.databaseUrl) {
    helmArgs.push('--set-string', `secrets.DATABASE_URL=${repos.databaseUrl}`)
  }
  return run('helm', helmArgs, projectRoot, profile)
}
