/** ACR image build/push + Helm deploy helpers for the Azure AKS provider. */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'pathe'
import { projectName } from '../../../shared.js'
import { azureEnv, capture, run } from './exec.js'
import { HELM_CHART, TF_DIR, kubeTarget } from './terraform.js'

/** ACR coordinates read from Terraform outputs. */
export interface AcrRepos {
  backend: string
  frontend: string
  /** Login server host, e.g. `myorgappacr.azurecr.io`. */
  registryHost: string
  /** Registry name without the domain — what every `az acr` command takes. */
  registryName: string
  location: string
  /** Public hostname the app is served on (Azure's own `*.cloudapp.azure.com`). */
  host?: string
  /** Full PostgreSQL connection string, when a managed database is provisioned. */
  databaseUrl?: string
}

export const tagArg = {
  tag: {
    type: 'string' as const,
    description:
      'Image tag (default: git short SHA, plus -dirty-<hash> if there are uncommitted changes).',
  },
}

export const platformArg = {
  platform: {
    type: 'string' as const,
    description: 'Docker build platform (default linux/amd64, to match AKS x86 nodes).',
  },
}

/**
 * Read the ACR repository URLs + location from Terraform outputs. Returns `null`
 * when the outputs aren't available (infra not applied, no credentials, …).
 */
export function readAcrRepos(projectRoot: string, subscription?: string): AcrRepos | null {
  const out = capture(
    'terraform',
    [`-chdir=${TF_DIR}`, 'output', '-json'],
    projectRoot,
    subscription,
  )
  if (out.status !== 0) return null
  try {
    const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
    const backend = o.acr_backend_repository_url?.value ?? ''
    const frontend = o.acr_frontend_repository_url?.value ?? ''
    const location = o.location?.value ?? ''
    const registryHost = o.acr_login_server?.value ?? backend.split('/')[0] ?? ''
    if (!backend || !frontend || !registryHost) return null
    return {
      backend,
      frontend,
      registryHost,
      // `<name>.azurecr.io` → `<name>`; every `az acr` subcommand wants the bare name.
      registryName: registryHost.split('.')[0] ?? registryHost,
      location,
      host: o.app_host?.value || undefined,
      databaseUrl: o.database_url?.value || undefined,
    }
  } catch {
    return null
  }
}

/** Resolve repos from Terraform outputs, printing the standard error on failure. */
export function requireAcrRepos(projectRoot: string, subscription: string): AcrRepos {
  const repos = readAcrRepos(projectRoot, subscription)
  if (!repos) {
    process.stderr.write(
      'error: could not read Terraform outputs (acr_*_repository_url) — run `dude iac apply` first.\n',
    )
    process.exit(1)
  }
  return repos
}

/**
 * Resolve the image tag. Precedence:
 *   1. an explicit `--tag` (validated as a Docker tag),
 *   2. the short git SHA of HEAD, suffixed with `-dirty-<hash>` when the working
 *      tree has uncommitted changes (so an unreproducible build is never
 *      mistaken for a clean commit).
 *
 * The `<hash>` digests the uncommitted diff, so each distinct working-tree state
 * gets its own tag and iterating on a branch doesn't keep overwriting one
 * `-dirty` image whose contents nobody can identify afterwards.
 *
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
  const tag = sha.stdout.trim()
  const dirt = workingTreeDigest(projectRoot)
  return dirt ? `${tag}-dirty-${dirt}` : tag
}

/**
 * A short digest of everything uncommitted, or `null` on a clean tree. Combines
 * `git status --porcelain` (which names untracked and staged files) with the
 * full diff against HEAD (which carries their tracked contents), so any edit
 * that would change the built image also changes the digest.
 */
function workingTreeDigest(projectRoot: string): string | null {
  const status = capture('git', ['status', '--porcelain'], projectRoot)
  if (status.status !== 0 || status.stdout.trim() === '') return null
  const diff = capture('git', ['diff', 'HEAD'], projectRoot)
  return createHash('sha256')
    .update(status.stdout)
    .update(diff.status === 0 ? diff.stdout : '')
    .digest('hex')
    .slice(0, 8)
}

/** The repository name inside an ACR URL (`<registry>.azurecr.io/<name>`). */
function repoName(repositoryUrl: string): string {
  return repositoryUrl.split('/').slice(1).join('/')
}

/**
 * Note on stderr when `tag` already exists in the registry, and return true.
 *
 * This is a *warning*, not a refusal — unlike ECR, an ACR repository accepts a
 * repeated tag and simply moves it to the new image (tag immutability is a
 * Premium-tier policy we deliberately don't require). Re-shipping the same
 * working tree is therefore legal, but it silently repoints a tag someone may
 * already have deployed, so it is worth saying out loud.
 */
export function warnTagExists(
  projectRoot: string,
  subscription: string | undefined,
  tag: string,
  repos: AcrRepos,
): boolean {
  const hit = [repos.backend, repos.frontend].find((repo) => {
    const r = capture(
      'az',
      ['acr', 'repository', 'show', '--name', repos.registryName, '--image', `${repoName(repo)}:${tag}`, '--output', 'none'],
      projectRoot,
      subscription,
    )
    return r.status === 0
  })
  if (!hit) return false
  process.stderr.write(
    `\n  ⚠  ${hit}:${tag} already exists in the registry and will be overwritten.\n` +
      '     The default tag comes from your git state, so the same commit with the same\n' +
      '     uncommitted changes always resolves to the same tag. Commit (new SHA → new\n' +
      '     tag) or pass --tag to keep the published images distinguishable.\n\n',
  )
  return true
}

/**
 * `az acr login --expose-token | docker login` without a shell pipe.
 *
 * `az acr login` alone would be enough on the host, but it writes the credential
 * into the Docker config of whichever machine runs it; exposing the token and
 * feeding it to `docker login` on stdin keeps the flow identical whether `az`
 * ran here or in the runner. The username is the fixed null GUID that ACR
 * requires for token-based logins.
 */
export function dockerLogin(
  repos: AcrRepos,
  projectRoot: string,
  subscription?: string,
): number {
  const r = capture(
    'az',
    ['acr', 'login', '--name', repos.registryName, '--expose-token', '--output', 'json'],
    projectRoot,
    subscription,
  )
  let token = ''
  let loginServer = repos.registryHost
  if (r.status === 0) {
    try {
      const o = JSON.parse(r.stdout) as { accessToken?: string; loginServer?: string }
      token = o.accessToken ?? ''
      loginServer = o.loginServer || loginServer
    } catch {
      /* fall through to the guard below */
    }
  }
  if (!token) {
    process.stderr.write(
      '\n  ✗  Could not obtain an ACR access token.\n' +
        `     Check you are signed in (dude iac login --env <env>) and that the\n` +
        `     registry "${repos.registryName}" exists in this subscription.\n\n`,
    )
    return 1
  }
  const login = spawnSync(
    'docker',
    ['login', '--username', '00000000-0000-0000-0000-000000000000', '--password-stdin', loginServer],
    {
      cwd: projectRoot,
      input: token,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: azureEnv(subscription),
    },
  )
  if (login.error) {
    const code = (login.error as NodeJS.ErrnoException).code
    process.stderr.write(
      code === 'ENOENT'
        ? '\n  ✗  `docker` not found on PATH. Install it and retry.\n\n'
        : `\n  ✗  failed to run docker: ${login.error.message}\n\n`,
    )
    return 1
  }
  return login.status ?? 1
}

/**
 * Build both production images, tagged for the environment's ACR repositories.
 * Defaults to `linux/amd64` because the AKS default node pool is x86 — building
 * on an arm64 laptop without this produces images that crash on the cluster with
 * `exec format error`.
 */
export function doBuild(
  projectRoot: string,
  subscription: string | undefined,
  tag: string,
  repos: AcrRepos,
  project: string,
  platform: string,
): number {
  process.stdout.write(`\n  → building backend  ${repos.backend}:${tag} (${platform})\n`)
  let code = run(
    'docker',
    ['build', '--platform', platform, '-f', 'backend/Dockerfile.prod', '-t', `${repos.backend}:${tag}`, 'backend'],
    projectRoot,
    subscription,
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
    subscription,
  )
  return code
}

/** Log in to ACR and push both images at `:tag`. */
export function doPush(
  projectRoot: string,
  subscription: string | undefined,
  tag: string,
  repos: AcrRepos,
): number {
  let code = dockerLogin(repos, projectRoot, subscription)
  if (code !== 0) return code
  process.stdout.write(`\n  → pushing ${repos.backend}:${tag}\n`)
  code = run('docker', ['push', `${repos.backend}:${tag}`], projectRoot, subscription)
  if (code !== 0) return code
  process.stdout.write(`\n  → pushing ${repos.frontend}:${tag}\n`)
  return run('docker', ['push', `${repos.frontend}:${tag}`], projectRoot, subscription)
}

/**
 * `helm upgrade --install`, wiring the registry, image tag and public hostname
 * from Terraform outputs so the user never has to hand-edit them into
 * values-<env>.yaml. The env values file (resources, secrets, …) is still
 * layered when present.
 */
export function doDeploy(
  projectRoot: string,
  subscription: string | undefined,
  env: string,
  ns: string,
  tag: string,
  repos: AcrRepos,
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
  // The Azure-assigned hostname (<dns-label>.<region>.cloudapp.azure.com) is only
  // known after apply, so it is wired here rather than committed into values.yaml.
  if (repos.host) {
    helmArgs.push('--set', `ingress.host=${repos.host}`)
  }
  // Wire the DB connection string straight from Terraform (no Key Vault).
  // --set-string avoids type coercion; the password is alphanumeric (special=false
  // in Terraform) so there are no commas/`=` to confuse helm's --set parser. This
  // takes precedence over anything in the (gitignored) values-<env>.yaml.
  if (repos.databaseUrl) {
    helmArgs.push('--set-string', `secrets.DATABASE_URL=${repos.databaseUrl}`)
  }
  return run('helm', helmArgs, projectRoot, subscription, kubeTarget(projectRoot, env, ns))
}
