/**
 * Shared test utilities for CLI integration tests.
 *
 * Built by tsup as the `testing` entry and exposed through the package's
 * `./testing` export, so it is importable from two places:
 *
 *   // co-located tests inside this package (compiled by vitest):
 *   import { Project, runCLI, isAvailable } from '../../utils/testing.js'
 *
 *   // tests in other workspace packages (e.g. the stack), via the built entry:
 *   import { Project } from '@cubocicloide/dude/testing'
 *
 * ── Design principles ──────────────────────────────────────────────────────
 *
 *  • Every test gets an ephemeral Project (tmpdir). No shared mutable state
 *    between suites.
 *  • Project.scaffold() is synchronous and fast enough for beforeAll().
 *  • File mutations are tracked with automatic backups so each it() can
 *    call restore() and leave the project in its original state.
 *  • No interactive prompts — cleanup is always automatic via afterAll().
 *    Use `make dev-init` for manual inspection during development.
 */

import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { getPackageRoot } from './paths.js'

/**
 * Absolute path to the monorepo root.
 * Uses getPackageRoot() so it resolves correctly from both src/ and dist/.
 */
export const REPO_ROOT = resolve(getPackageRoot(), '../..')

/** Absolute path to the local dude binary. Never the globally-installed one. */
export const DUDE_BIN = resolve(REPO_ROOT, 'packages/dude/bin/dude.mjs')

// ── Primitives ──────────────────────────────────────────────────────────────

export interface RunResult {
  status: number | null
  stdout: string
  stderr: string
  error?: Error
}

/** True when `cmd --version` exits without error. */
export function isAvailable(cmd: string): boolean {
  return spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: true }).error == null
}

/**
 * Run the local dude CLI directly (without a project context).
 * cwd defaults to REPO_ROOT so top-level commands like init/help/version work.
 */
export function runCLI(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): RunResult {
  const r = spawnSync('node', [DUDE_BIN, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ...opts.env },
  })
  return {
    status: r.status ?? null,
    stdout: (r.stdout as string) ?? '',
    stderr: (r.stderr as string) ?? '',
    error: r.error,
  }
}

// ── Project ─────────────────────────────────────────────────────────────────

export interface ScaffoldOpts {
  /** Stack spec to pass to --stack (default: local react-fastapi). */
  stack?: string
  /** Extra flags for dude init (default: ['--yes']). */
  flags?: string[]
  /** Prefix for the tmpdir name (default: 'dude-test-'). */
  prefix?: string
}

/**
 * An ephemeral scaffolded project created in a tmpdir.
 *
 * Typical usage in a test file:
 *
 *   let project: Project
 *   beforeAll(() => { project = Project.scaffold() }, 60_000)
 *   afterAll(() => project.cleanup())
 *
 *   it('exits 0 on a clean scaffold', () => {
 *     expect(project.run('lint').status).toBe(0)
 *   })
 *
 *   it('exits 1 when a required file is missing', () => {
 *     project.remove('backend/app/fixtures')
 *     expect(project.run('lint').status).toBe(1)
 *     project.restore('backend/app/fixtures')
 *   })
 */
export class Project {
  /** Absolute path to the project root in tmpdir. */
  readonly dir: string

  // rel path → backup absolute path (rel + '.__dude_bak'), or null when
  // the file was newly created (does not exist in the original scaffold).
  private readonly backups = new Map<string, string | null>()

  private constructor(dir: string) {
    this.dir = dir
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Scaffold a fresh project via `dude init` into a new tmpdir.
   *
   * The local binary is symlinked into node_modules/.bin so that
   * `pnpm dude <cmd>` inside the project uses the live source tree,
   * consistent with `make dev-init`.
   *
   * Throws if `dude init` exits non-zero.
   */
  static scaffold(opts: ScaffoldOpts = {}): Project {
    const stack = opts.stack ?? './stacks/react-fastapi'
    const flags = opts.flags ?? ['--yes']
    const prefix = opts.prefix ?? 'dude-test-'

    const dir = mkdtempSync(join(tmpdir(), prefix))

    const r = spawnSync('node', [DUDE_BIN, 'init', '--stack', stack, ...flags, dir], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    })

    if ((r.status ?? 1) !== 0) {
      rmSync(dir, { recursive: true, force: true })
      throw new Error(`dude init failed (exit ${r.status}):\n${r.stderr as string}`)
    }

    // Wire the local binary so commands use the live source tree.
    const binDir = join(dir, 'node_modules', '.bin')
    mkdirSync(binDir, { recursive: true })
    const link = join(binDir, 'dude')
    if (!existsSync(link)) {
      try {
        symlinkSync(DUDE_BIN, link)
      } catch {
        // Ignore if symlink already exists from a previous run.
      }
    }

    return new Project(dir)
  }

  // ── Command runner ────────────────────────────────────────────────────────

  /** Run `node DUDE_BIN <cmd> [...args]` with the project dir as cwd. */
  run(cmd: string, ...args: string[]): RunResult {
    return runCLI([cmd, ...args], { cwd: this.dir })
  }

  // ── Filesystem helpers ────────────────────────────────────────────────────

  /** Absolute path for a project-relative path. */
  abs(rel: string): string {
    return join(this.dir, rel)
  }

  /** Read a file from the project directory. */
  readFile(rel: string): string {
    return readFileSync(this.abs(rel), 'utf8')
  }

  /** Whether a path exists inside the project. */
  exists(rel: string): boolean {
    return existsSync(this.abs(rel))
  }

  /**
   * Write a file, backing up the original so it can be restored.
   * Calling restore(rel) reverts to the backed-up content.
   */
  write(rel: string, content: string): void {
    const abs = this.abs(rel)
    if (!this.backups.has(rel)) {
      if (existsSync(abs)) {
        const bak = abs + '.__dude_bak'
        copyFileSync(abs, bak)
        this.backups.set(rel, bak)
      } else {
        // File is new — mark with null so restore() knows to delete it.
        this.backups.set(rel, null)
      }
    }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  /**
   * Remove a file or directory by renaming it to a backup path.
   * Calling restore(rel) brings it back.
   */
  remove(rel: string): void {
    const abs = this.abs(rel)
    const bak = abs + '.__dude_bak'
    renameSync(abs, bak)
    this.backups.set(rel, bak)
  }

  /**
   * Restore a path previously modified via write() or remove().
   * Throws if no backup is registered for rel.
   */
  restore(rel: string): void {
    if (!this.backups.has(rel)) {
      throw new Error(`No backup found for "${rel}" — did you call write() or remove() first?`)
    }
    const bak = this.backups.get(rel) ?? null
    const abs = this.abs(rel)
    if (existsSync(abs)) rmSync(abs, { recursive: true, force: true })
    if (bak !== null) {
      // Existing file was overwritten — rename backup back.
      renameSync(bak, abs)
    }
    // If bak is null the file was newly created and has now been deleted.
    this.backups.delete(rel)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Delete the tmpdir. Call from afterAll(). */
  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true })
  }
}
