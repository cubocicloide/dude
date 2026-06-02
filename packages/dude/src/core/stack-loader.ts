import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath, isAbsolute, dirname } from 'pathe'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import type { StackDefinition } from './stack-contract.js'

const require = createRequire(import.meta.url)
const selfDir = dirname(fileURLToPath(import.meta.url))

interface LoadedStack {
  definition: StackDefinition
  /** Absolute path of the stack package root (containing `package.json`). */
  root: string
  /** Resolved version of the stack (read from its package.json). */
  version: string
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
export async function loadStack(spec: string, cwd: string, version?: string): Promise<LoadedStack> {
  const root = await resolveStackRoot(spec, cwd, version)
  const pkgJsonPath = resolvePath(root, 'package.json')
  if (!existsSync(pkgJsonPath)) {
    throw new Error(`Stack at "${root}" is missing a package.json`)
  }

  const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8')) as {
    version?: string
    main?: string
    module?: string
    exports?: unknown
  }
  const resolvedVersion = pkgJson.version ?? 'unknown'
  const entry = pkgJson.module ?? pkgJson.main ?? 'dist/index.js'
  const entryPath = resolvePath(root, entry)

  if (!existsSync(entryPath)) {
    throw new Error(
      `Stack entry point not found: ${entryPath}\n` +
        `Did you build the stack package? Try \`make build\`.`,
    )
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

  return { definition: mod.default, root, version: resolvedVersion }
}

async function resolveStackRoot(spec: string, cwd: string, version?: string): Promise<string> {
  // Filesystem path?
  if (spec.startsWith('.') || spec.startsWith('/') || isAbsolute(spec)) {
    return resolvePath(cwd, spec)
  }

  // Try standard Node resolution first (works for installed packages).
  try {
    const pkgJsonPath = require.resolve(`${spec}/package.json`, { paths: [cwd] })
    return resolvePath(pkgJsonPath, '..')
  } catch {
    // fall through to workspace scan
  }

  // Dev fallback: walk up from `cwd` or from this module's own location
  // looking for a pnpm workspace, then scan its declared globs for a
  // package.json whose `name` matches `spec`.
  const workspaceMatch = findInPnpmWorkspace(cwd, spec) ?? findInPnpmWorkspace(selfDir, spec)
  if (workspaceMatch) return workspaceMatch

  // Last resort: install from the registry into the dude cache dir.
  return installStack(spec, version)
}

/**
 * Install a stack package into `~/.dude/cache/stacks/` and return the
 * path to the installed package root. Subsequent calls with the same
 * name + version are no-ops (the cached copy is reused).
 *
 * When no version is provided, the latest version is resolved from the npm
 * registry first. Auth is handled via the user's `~/.npmrc`.
 */
function installStack(packageName: string, version?: string): string {
  const resolvedVersion = version ?? resolveLatestVersion(packageName)
  const safeName = packageName.replace(/\//g, '__').replace(/@/g, '')
  const cacheDir = resolvePath(homedir(), '.dude', 'cache', 'stacks', `${safeName}@${resolvedVersion}`)
  const installedPkgPath = resolvePath(cacheDir, 'node_modules', packageName, 'package.json')

  if (!existsSync(installedPkgPath)) {
    process.stderr.write(`\n  ℹ  Stack not found locally — installing ${packageName}@${resolvedVersion}...\n`)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(
      resolvePath(cacheDir, 'package.json'),
      JSON.stringify(
        { name: 'dude-stack-cache', private: true, dependencies: { [packageName]: resolvedVersion } },
        null,
        2,
      ),
    )
    try {
      execFileSync('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund'], {
        cwd: cacheDir,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env },
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
 * Query the npm registry for the latest version of a package.
 * Uses the user's ~/.npmrc for authentication (scope → registry mapping).
 */
function resolveLatestVersion(packageName: string): string {
  try {
    const output = execFileSync(
      'npm',
      ['view', packageName, 'version', '--json'],
      { env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const parsed: unknown = JSON.parse(output.toString().trim())
    // npm may return a string or an array (dist-tags case); take the last item.
    if (typeof parsed === 'string') return parsed
    if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[parsed.length - 1])
    throw new Error('Unexpected npm view output')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Could not resolve latest version of "${packageName}" from the registry.\n` +
        `Make sure your ~/.npmrc is configured with a valid token.\n${msg}`,
    )
  }
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
