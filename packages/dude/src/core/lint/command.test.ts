/**
 * Unit tests for the shared `lint` command (`defineLintCommand`).
 *
 * These cover the presentation behavior — filtering, summary, notices, exit
 * code — with the engine mocked. Engine behavior (discovery, collisions,
 * disable) is covered in `index.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import type { Diagnostic } from './types.js'

// Mock the engine before importing the module under test.
const { runLint } = vi.hoisted(() => ({ runLint: vi.fn() }))
vi.mock('./index.js', () => ({ runLint }))

import { defineLintCommand } from './command.js'

class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`)
  }
}

let stdout: string[]
let stderr: string[]
let exitSpy: MockInstance<typeof process.exit>

function diag(
  severity: 'error' | 'warning',
  message: string,
  file = 'src/foo.ts',
): Diagnostic {
  return { file, line: 1, col: 1, severity, message, code: 'XX001' }
}

function lintResult(diagnostics: Diagnostic[], notices: string[] = []) {
  return {
    diagnostics,
    errorCount: diagnostics.filter((d) => d.severity === 'error').length,
    warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
    notices,
  }
}

function ctx(args: Record<string, unknown> = {}) {
  return { projectRoot: '/project', stackRoot: '/stack', args }
}

beforeEach(() => {
  runLint.mockReset()
  stdout = []
  stderr = []
  vi.spyOn(process.stdout, 'write').mockImplementation((s) => (stdout.push(String(s)), true))
  vi.spyOn(process.stderr, 'write').mockImplementation((s) => (stderr.push(String(s)), true))
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new ProcessExitError(code ?? 0)
  }) as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('defineLintCommand — definition', () => {
  it('uses the default description when none is given', () => {
    expect(defineLintCommand().description).toContain('stack')
  })

  it('accepts a custom description', () => {
    const def = defineLintCommand({ description: 'Custom wording.' })
    expect(def.description).toBe('Custom wording.')
  })

  it('declares the quiet flag', () => {
    expect(defineLintCommand().args?.quiet?.type).toBe('boolean')
  })
})

describe('lint — no issues', () => {
  it('prints "No issues found." and returns without exiting', async () => {
    runLint.mockResolvedValue(lintResult([]))

    await expect(defineLintCommand().run(ctx())).resolves.toBeUndefined()

    expect(stdout.join('')).toContain('No issues found.')
    expect(stderr.join('')).toBe('')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('calls runLint with (projectRoot, stackRoot)', async () => {
    runLint.mockResolvedValue(lintResult([]))

    await defineLintCommand().run(ctx())

    expect(runLint).toHaveBeenCalledWith('/project', '/stack')
  })
})

describe('lint — warnings only', () => {
  it('prints the warning, writes a summary to stderr, and returns without exiting', async () => {
    runLint.mockResolvedValue(lintResult([diag('warning', 'avoid this pattern')]))

    await expect(defineLintCommand().run(ctx())).resolves.toBeUndefined()

    expect(stdout.join('')).toContain('avoid this pattern')
    expect(stderr.join('')).toContain('1 warning')
    expect(stderr.join('')).not.toContain('error')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('pluralizes the warning count in the summary', async () => {
    runLint.mockResolvedValue(lintResult([diag('warning', 'a'), diag('warning', 'b')]))

    await defineLintCommand().run(ctx())

    expect(stderr.join('')).toContain('2 warnings')
  })
})

describe('lint — quiet mode', () => {
  it('filters out warnings; only error-severity diagnostics are printed', async () => {
    runLint.mockResolvedValue(
      lintResult([diag('warning', 'a warning message'), diag('error', 'an error message')]),
    )

    await expect(defineLintCommand().run(ctx({ quiet: true }))).rejects.toThrow(ProcessExitError)

    expect(stdout.join('')).toContain('an error message')
    expect(stdout.join('')).not.toContain('a warning message')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('prints nothing to stdout when quiet and only warnings exist', async () => {
    runLint.mockResolvedValue(lintResult([diag('warning', 'just a warning')]))

    await defineLintCommand().run(ctx({ quiet: true }))

    expect(stdout.join('')).toBe('')
    expect(stderr.join('')).toContain('1 warning')
  })
})

describe('lint — errors present', () => {
  it('prints diagnostics then exits with code 1', async () => {
    runLint.mockResolvedValue(lintResult([diag('error', 'broken thing')]))

    await expect(defineLintCommand().run(ctx())).rejects.toThrow(ProcessExitError)

    expect(stdout.join('')).toContain('broken thing')
    expect(stderr.join('')).toContain('1 error')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('summary includes both errors and warnings, pluralized', async () => {
    runLint.mockResolvedValue(
      lintResult([diag('error', 'e1'), diag('error', 'e2'), diag('warning', 'w1')]),
    )

    await expect(defineLintCommand().run(ctx())).rejects.toThrow(ProcessExitError)

    expect(stderr.join('')).toContain('2 errors')
    expect(stderr.join('')).toContain('1 warning')
  })
})

describe('lint — notices', () => {
  it('surfaces engine notices on stderr even when the run is clean', async () => {
    runLint.mockResolvedValue(lintResult([], ['lint.disable lists "ZZ999" but no such check exists']))

    await defineLintCommand().run(ctx())

    expect(stderr.join('')).toContain('notice: lint.disable lists "ZZ999"')
    expect(stdout.join('')).toContain('No issues found.')
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
