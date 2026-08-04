import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath, isAbsolute, dirname } from 'pathe'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { stackDocsSchema, type StackDefinition } from './stack-contract.js'

const require = createRequire(import.meta.url)
const selfDir = dirname(fileURLToPath(import.meta.url))

function shouldUseShell(platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'win32'
}

interface LoadedStack {
  definition: StackDefinition
  /** Absolute path of the stack package root (containing `package.json`). */
  root: string
  /** Resolved version of the stack (read from its package.json). */
  version: string
}

/**
 * Describes how a stack root was resolved — used to tailor error messages.
 *
 * - `node`      : resolved via Node's require.resolve (installed package)
 * - `workspace` : found by scanning a pnpm-workspace.yaml (source checkout)
 * - `cache`     : downloaded into ~/.dude/cache/stacks/
 * - `path`      : caller supplied an explicit filesystem path
 */
type ResolutionSource = 'node' | 'workspace' | 'cache' | 'path'

interface ResolvedRoot {
  root: string
  source: ResolutionSource
}

/**
 * Resolve a stack identifier into a loaded plugin.
 *
 * Supported forms in this bootstrap phase:
 *   - absolute or relative filesystem path to the stack package
 *   - bare npm package name (resolved through Node's module resolver — works
 *     for pnpm workspace packages out of the box)
 *
 * Registry-driven resolution and on-demand npm download will arrive in a
 * later phase; the contract here is forward-compatible.
 */
export async function loadStack(
  spec: string,
  cwd: string,
  version?: string,
  channel: string = 'latest',
): Promise<LoadedStack> {
  const { root, source } = await resolveStackRoot(spec, cwd, version, channel)
  const pkgJsonPath = resolvePath(root, 'package.json')
  if (!existsSync(pkgJsonPath)) {
    throw new Error(`Stack at "${root}" is missing a package.json`)
  }

  const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8')) as {
    version?: string
    name?: string
    main?: string
    module?: string
    exports?: unknown
  }
  const resolvedVersion = pkgJson.version ?? 'unknown'
  const pkgName = pkgJson.name ?? spec
  const entry = pkgJson.module ?? pkgJson.main ?? 'dist/index.js'
  const entryPath = resolvePath(root, entry)

  if (!existsSync(entryPath)) {
    throw new Error(buildMissingEntryError(entryPath, pkgName, source))
  }

  const mod = (await import(pathToFileURL(entryPath).href)) as {
    default?: StackDefinition
  }
  if (!mod.default || typeof mod.default !== 'object') {
    throw new Error(
      `Stack package "${spec}" must export a default StackDefinition ` +
        `(created via defineStack()).`,
    )
  }

  // The `docs` manifest is optional, but when a stack declares one it must be
  // well-formed — an invalid manifest should fail loudly at load time rather
  // than silently degrade for whatever consumes it downstream (root-site
  // composer, cheatsheet, machine-readable surface — see issue #113).
  if (mod.default.docs !== undefined) {
    const result = stackDocsSchema.safeParse(mod.default.docs)
    if (!result.success) {
      throw new Error(
        `Stack "${pkgName}" declares an invalid \`docs\` manifest:\n` +
          result.error.issues
            .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('\n'),
      )
    }
  }

  return { definition: mod.default, root, version: resolvedVersion }
}

/**
 * Build a human-readable error for a missing stack entry point, with
 * context-sensitive remediation steps based on how the stack was resolved.
 *
 * - workspace checkout: show both `pnpm --filter <pkg> build` and `make build`
 * - installed package / cache: suggest reinstalling or clearing the cache
 * - explicit path: show the path and the generic build hint
 */
function buildMissingEntryError(
  entryPath: string,
  pkgName: string,
  source: ResolutionSource,
): string {
  const lines: string[] = [`Stack entry point not found: ${entryPath}`, '']

  if (source === 'workspace') {
    lines.push(
      'This stack was resolved from a local source-checkout (pnpm workspace).',
      'The package has not been built yet. Run one of the following to compile it:',
      '',
      `  pnpm --filter ${pkgName} build   # build only this stack`,
      '  make build                        # build the entire monorepo',
      '',
      'After building, re-run your dude command.',
    )
  } else if (source === 'node') {
    lines.push(
      'The installed stack package appears to be missing its compiled output.',
      'Try reinstalling your project dependencies:',
      '',
      '  pnpm install   # or: npm install / yarn install',
      '',
      `If the problem persists, remove node_modules and reinstall, or upgrade`,
      `the stack pin with: dude upgrade --stack`,
    )
  } else if (source === 'cache') {
    lines.push(
      'The cached stack package is missing its compiled output.',
      'Clear the dude stack cache and let it re-download:',
      '',
      '  rm -rf ~/.dude/cache/stacks',
      '',
      'Then re-run your dude command.',
    )
  } else {
    // path
    lines.push(
      'Did you build the stack package?',
      '',
      `  pnpm --filter ${pkgName} build   # or: make build`,
    )
  }

  return lines.join('\n')
}

async function resolveStackRoot(
  spec: string,
  cwd: string,
  version?: string,
  channel: string = 'latest',
): Promise<ResolvedRoot> {
  // Filesystem path?
  if (spec.startsWith('.') || spec.startsWith('/') || isAbsolute(spec)) {
    return { root: resolvePath(cwd, spec), source: 'path' }
  }

  // Try standard Node resolution first (works for installed packages).
  try {
    const pkgJsonPath = require.resolve(`${spec}/package.json`, { paths: [cwd] })
    return { root: resolvePath(pkgJsonPath, '..'), source: 'node' }
  } catch {
    // fall through to workspace scan
  }

  // Dev fallback: walk up from `cwd` or from this module's own location
  // looking for a pnpm workspace, then scan its declared globs for a
  // package.json whose `name` matches `spec`.
  const workspaceMatch = findInPnpmWorkspace(cwd, spec) ?? findInPnpmWorkspace(selfDir, spec)
  if (workspaceMatch) return { root: workspaceMatch, source: 'workspace' }

  // Last resort: install from the registry into the dude cache dir.
  return { root: installStack(spec, version, channel), source: 'cache' }
}

/**
 * Install a stack package into `~/.dude/cache/stacks/` and return the
 * path to the installed package root. Subsequent calls with the same
 * name + version are no-ops (the cached copy is reused).
 *
 * When no version is provided, the version is resolved from the npm registry
 * by dist-tag: `latest` (the stable channel) by default, or whichever channel
 * the caller asked for (e.g. `next` for the newest published candidate).
 * Auth is handled via the user's `~/.npmrc`.
 */
function installStack(packageName: string, version?: string, channel: string = 'latest'): string {
  const resolvedVersion = version ?? resolveChannelVersion(packageName, channel)
  const safeName = packageName.replace(/\//g, '__').replace(/@/g, '')
  const cacheDir = resolvePath(
    homedir(),
    '.dude',
    'cache',
    'stacks',
    `${safeName}@${resolvedVersion}`,
  )
  const installedPkgPath = resolvePath(cacheDir, 'node_modules', packageName, 'package.json')

  if (!existsSync(installedPkgPath)) {
    process.stderr.write(
      `\n  ℹ  Stack not found locally — installing ${packageName}@${resolvedVersion}...\n`,
    )
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(
      resolvePath(cacheDir, 'package.json'),
      JSON.stringify(
        {
          name: 'dude-stack-cache',
          private: true,
          dependencies: { [packageName]: resolvedVersion },
        },
        null,
        2,
      ),
    )
    try {
      execFileSync('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund'], {
        cwd: cacheDir,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env },
        shell: shouldUseShell(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to install ${packageName}@${resolvedVersion}: ${msg}`)
    }
    process.stderr.write(`  ✓  Installed ${packageName}@${resolvedVersion}\n\n`)
  }

  return resolvePath(cacheDir, 'node_modules', packageName)
}

/**
 * Query the npm registry for the version a release channel (dist-tag) points
 * to: `latest` is the stable channel, `next` the newest published candidate.
 * Uses the user's ~/.npmrc for authentication (scope → registry mapping).
 */
function resolveChannelVersion(packageName: string, channel: string = 'latest'): string {
  let tags: Record<string, string>
  try {
    const output = execFileSync('npm', ['view', packageName, 'dist-tags', '--json'], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: shouldUseShell(),
    })
    tags = JSON.parse(output.toString().trim()) as Record<string, string>
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Could not resolve the "${channel}" version of "${packageName}" from the registry.\n` +
        `Make sure your ~/.npmrc is configured with a valid token.\n${msg}`,
    )
  }

  return pickChannelVersion(tags, channel, packageName)
}

/**
 * Pick the version a channel (dist-tag) points to out of a package's dist-tag
 * map, with actionable errors when the channel is absent. Exported for tests.
 */
export function pickChannelVersion(
  tags: Record<string, string>,
  channel: string,
  packageName: string,
): string {
  const version = tags[channel]
  if (typeof version === 'string' && version.length > 0) return version

  const available = Object.keys(tags).join(', ') || 'none'
  const hint =
    channel === 'latest'
      ? `No release of "${packageName}" has been promoted to stable yet.\n` +
        `Pass --next to use the newest published candidate, or ask a maintainer to promote one.`
      : `The "${channel}" channel has no published release for "${packageName}".`
  throw new Error(`${hint}\n(available dist-tags: ${available})`)
}

function findInPnpmWorkspace(startDir: string, pkgName: string): string | null {
  let dir = startDir
  // Walk up until we find pnpm-workspace.yaml or hit the filesystem root.
  for (;;) {
    const wsFile = resolvePath(dir, 'pnpm-workspace.yaml')
    if (existsSync(wsFile)) {
      // Parse minimally: collect `packages:` glob roots. We only support the
      // common `dir/*` form here to avoid pulling in a YAML dep just for dev.
      const content = readFileSync(wsFile, 'utf8')
      const roots = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-'))
        .map((l) => l.replace(/^-\s*['"]?/, '').replace(/['"]?$/, ''))
        .map((g) => g.replace(/\/\*$/, ''))

      for (const root of roots) {
        const absRoot = resolvePath(dir, root)
        if (!existsSync(absRoot)) continue
        for (const child of readdirSync(absRoot, { withFileTypes: true })) {
          if (!child.isDirectory()) continue
          const pkgPath = resolvePath(absRoot, child.name, 'package.json')
          if (!existsSync(pkgPath)) continue
          try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
              name?: string
            }
            if (pkg.name === pkgName) {
              return resolvePath(absRoot, child.name)
            }
          } catch {
            // ignore malformed package.json
          }
        }
      }
      return null
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}
