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
    main?: string
    module?: string
    exports?: unknown
  }
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

  return { definition: mod.default, root }
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
  if (version) {
    return installStack(spec, version)
  }

  throw new Error(
    `Could not resolve stack "${spec}". Pass a workspace path (e.g. ` +
      `../stacks/react-fastapi) or install the stack package first.`,
  )
}

/**
 * Install a stack package into `~/.dude/cache/stacks/` and return the
 * path to the installed package root. Subsequent calls with the same
 * name + version are no-ops (the cached copy is reused).
 *
 * npm is used deliberately (not pnpm) so this works outside pnpm workspaces.
 * Auth is handled via the user's `~/.npmrc`.
 */
function installStack(packageName: string, version: string): string {
  const safeName = packageName.replace(/\//g, '__').replace(/@/g, '')
  const cacheDir = resolvePath(homedir(), '.dude', 'cache', 'stacks', `${safeName}@${version}`)
  const installedPkgPath = resolvePath(cacheDir, 'node_modules', packageName, 'package.json')

  if (!existsSync(installedPkgPath)) {
    process.stderr.write(`\n  ℹ  Stack not found locally — installing ${packageName}@${version}...\n`)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(
      resolvePath(cacheDir, 'package.json'),
      JSON.stringify(
        { name: 'dude-stack-cache', private: true, dependencies: { [packageName]: version } },
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
      throw new Error(`Failed to install ${packageName}@${version}: ${msg}`)
    }
    process.stderr.write(`  ✓  Installed ${packageName}@${version}\n\n`)
  }

  return resolvePath(cacheDir, 'node_modules', packageName)
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
