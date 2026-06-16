/**
 * dude-launcher — a tiny, stable global shim.
 *
 * Typing `dude <cmd>` anywhere resolves to the *project's* pinned toolchain:
 * the launcher finds the nearest `dude.json`, makes sure the project's exact
 * `@cubocicloide/dude` + stack versions are installed (running the project's
 * package manager if not), then re-execs the project-local `dude` binary.
 *
 * This is the only piece installed globally; it changes rarely. All real logic
 * lives in the per-project CLI, so two projects on the same machine transparently
 * run two different CLI/stack versions with no manual switching.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const CLI_PACKAGE = '@cubocicloide/dude'

/** Commands that make sense without a project (handled by the latest CLI via npx). */
const GLOBAL_SAFE = new Set(['init', 'version', 'help', '--version', '--help', '-v', '-h'])

export type PackageManager = 'pnpm' | 'yarn' | 'npm'

/** Walk up from `startDir` looking for the nearest directory containing dude.json. */
export function findProjectRoot(startDir: string): string | null {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'dude.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Pick the package manager by which lockfile the project carries. */
export function detectPackageManager(projectRoot: string): PackageManager {
  if (existsSync(join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(projectRoot, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Installed version of a package in the project's node_modules, or null if absent. */
export function installedVersion(projectRoot: string, pkgName: string): string | null {
  const pkg = readJson(join(projectRoot, 'node_modules', pkgName, 'package.json'))
  return typeof pkg?.version === 'string' ? pkg.version : null
}

/** A pin is "exact" when it is a bare version (`0.7.0`), not a range (`^`, `~`, `workspace:`). */
export function isExactPin(spec: string): boolean {
  return /^\d/.test(spec.trim())
}

export interface InstallDecision {
  needed: boolean
  reason: string
}

/**
 * Decide whether the project toolchain must be (re)installed before running.
 * Triggers when the local binary is missing, a pinned package is absent, or an
 * *exact* pin disagrees with what's installed. Range pins are trusted as-is to
 * avoid reinstalling on every invocation.
 */
export function needsInstall(projectRoot: string): InstallDecision {
  if (!existsSync(join(projectRoot, 'node_modules', '.bin', 'dude'))) {
    return { needed: true, reason: 'dude binary not installed' }
  }

  const pkg = readJson(join(projectRoot, 'package.json')) ?? {}
  const deps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  }

  // Verify the CLI plus the stack named in dude.json (skip local-path stacks).
  const manifest = readJson(join(projectRoot, 'dude.json')) ?? {}
  const toCheck = new Set<string>([CLI_PACKAGE])
  const stack = manifest.stack
  if (typeof stack === 'string' && !stack.startsWith('.') && !stack.startsWith('/')) {
    toCheck.add(stack)
  }

  for (const name of toCheck) {
    const pin = deps[name]
    if (!pin) continue
    const installed = installedVersion(projectRoot, name)
    if (installed === null) return { needed: true, reason: `${name} not installed` }
    if (isExactPin(pin) && installed !== pin) {
      return { needed: true, reason: `${name} pinned ${pin} but ${installed} is installed` }
    }
  }

  return { needed: false, reason: '' }
}

/**
 * Re-exec the project-local dude binary with the given args; returns its exit
 * code. Runs with cwd = projectRoot (where dude.json lives) so the CLI resolves
 * the project even when the launcher was invoked from a subdirectory.
 */
function execLocal(projectRoot: string, argv: string[]): number {
  const localBin = join(projectRoot, 'node_modules', '.bin', 'dude')
  if (!existsSync(localBin)) {
    process.stderr.write(
      'dude: node_modules/.bin/dude is missing after install — try a clean install.\n',
    )
    return 1
  }
  const res = spawnSync(localBin, argv, { cwd: projectRoot, stdio: 'inherit' })
  return res.status ?? 1
}

/**
 * Launcher entry point. Synchronous (spawnSync) by design — a launcher should
 * block on the child and forward its exit code.
 */
export function run(argv: string[] = process.argv.slice(2), cwd: string = process.cwd()): number {
  const projectRoot = findProjectRoot(cwd)

  if (projectRoot) {
    // Escape hatch: DUDE_SKIP_PROVISION runs whatever is already installed.
    if (!process.env.DUDE_SKIP_PROVISION) {
      const decision = needsInstall(projectRoot)
      if (decision.needed) {
        const pm = detectPackageManager(projectRoot)
        process.stderr.write(
          `dude: provisioning project toolchain (${decision.reason}) — running \`${pm} install\`…\n`,
        )
        const install = spawnSync(pm, ['install'], { cwd: projectRoot, stdio: 'inherit' })
        if (install.status !== 0) {
          process.stderr.write(
            'dude: toolchain install failed. Ensure GITHUB_TOKEN is set, then retry.\n',
          )
          return install.status ?? 1
        }
      }
    }
    return execLocal(projectRoot, argv)
  }

  // No project in scope.
  const cmd = argv[0]
  if (cmd === undefined || GLOBAL_SAFE.has(cmd)) {
    // Delegate project-less commands (notably `init`) to the latest published
    // CLI; npx handles the download and its own cache.
    const res = spawnSync('npx', ['--yes', `${CLI_PACKAGE}@latest`, ...argv], {
      cwd,
      stdio: 'inherit',
    })
    return res.status ?? 1
  }

  process.stderr.write(
    `dude: no dude.json found in ${cwd} or any parent directory.\n` +
      'Run `dude init` to scaffold a project, or cd into an existing one.\n',
  )
  return 1
}
