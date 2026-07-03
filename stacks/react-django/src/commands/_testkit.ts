/**
 * Shared test fixtures and helpers for the co-located command tests.
 *
 * Not a command module: it is never imported by `src/index.ts`, is excluded
 * from the tsup build (only `index.ts` + the lint-check entries are built), and
 * is not published (only `dist/` ships). It exists purely to back `*.test.ts`
 * files that sit next to the source they exercise.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterEach, vi } from 'vitest'
import path from 'pathe'

const created: string[] = []

afterEach(() => {
  while (created.length) {
    const dir = created.pop()!
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * A declarative description of files to create. Keys are POSIX-style relative
 * paths (use `/`). A string value writes a file with that content. A `null`
 * value (or a key ending in `/`) creates an empty directory.
 */
export type Tree = Record<string, string | null>

/** Create a fresh temp project from a {path: content} tree and return its root. */
export function makeProject(tree: Tree = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dude-cmd-'))
  created.push(root)
  for (const [rel, content] of Object.entries(tree)) {
    const abs = path.join(root, rel)
    if (content === null || rel.endsWith('/')) {
      mkdirSync(abs, { recursive: true })
      continue
    }
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  return root
}

/** Create an empty tracked temp dir (e.g. for baseline file round-trips). */
export function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dude-tmp-'))
  created.push(dir)
  return dir
}

/** Collect just the human-readable messages from a diagnostic list. */
export function messages(diags: Array<{ message: string }>): string[] {
  return diags.map((d) => d.message)
}

// ── Process I/O capture ──────────────────────────────────────────────────────

export interface IOCapture {
  /** Everything written to process.stdout since capture began. */
  stdout(): string
  /** Everything written to process.stderr since capture began. */
  stderr(): string
  /** Restore the original write functions. */
  restore(): void
}

/**
 * Capture stdout/stderr writes. Spies are auto-restored by vitest's
 * `restoreMocks` between tests, but `restore()` is provided for explicit use.
 */
export function captureIO(): IOCapture {
  let out = ''
  let err = ''
  const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    out += typeof chunk === 'string' ? chunk : chunk.toString()
    return true
  })
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    err += typeof chunk === 'string' ? chunk : chunk.toString()
    return true
  })
  return {
    stdout: () => out,
    stderr: () => err,
    restore: () => {
      outSpy.mockRestore()
      errSpy.mockRestore()
    },
  }
}

// ── process.exit ─────────────────────────────────────────────────────────────

/** Thrown by the mocked `process.exit` so tests can assert the exit code. */
export class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`)
    this.name = 'ProcessExitError'
  }
}

/**
 * Replace `process.exit` with a stub that throws {@link ProcessExitError}
 * instead of terminating the test runner. Returns the spy.
 */
export function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    throw new ProcessExitError(typeof code === 'number' ? code : 0)
  })
}

// ── Stack command context ────────────────────────────────────────────────────

/** Build a minimal context object for invoking a StackCommandDef's `run`. */
export function makeCtx(projectRoot: string, args: Record<string, unknown> = {}, stackRoot = '') {
  return { projectRoot, stackRoot, args } as any
}
