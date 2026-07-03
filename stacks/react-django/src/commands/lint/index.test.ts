import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock the dude package before importing the module under test.
const { runLint, formatDiagnostic } = vi.hoisted(() => ({
  runLint: vi.fn(),
  formatDiagnostic: vi.fn(),
}))
vi.mock('@cubocicloide/dude', () => ({ runLint, formatDiagnostic }))

import { lintCommand } from './index'

type Severity = 'error' | 'warning'
interface Diagnostic {
  file: string
  line: number
  col: number
  severity: Severity
  message: string
}

function diag(severity: Severity, message: string, file = 'src/foo.ts', line = 1, col = 1): Diagnostic {
  return { file, line, col, severity, message }
}

function lintResult(diagnostics: Diagnostic[]) {
  return {
    diagnostics,
    errorCount: diagnostics.filter((d) => d.severity === 'error').length,
    warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
  }
}

beforeEach(() => {
  runLint.mockReset()
  formatDiagnostic.mockReset()
  formatDiagnostic.mockImplementation((d: Diagnostic) => `${d.file}:${d.line} ${d.message}`)
})

describe('lint — no issues', () => {
  it('prints "No issues found." and returns without exiting', async () => {
    const io = captureIO()
    runLint.mockResolvedValue(lintResult([]))
    const root = makeProject({ 'README.md': '' })

    await expect(lintCommand.run!(makeCtx(root, { quiet: false }, '/stack'))).resolves.toBeUndefined()

    expect(io.stdout()).toContain('No issues found.')
    expect(io.stderr()).toBe('')
    expect(formatDiagnostic).not.toHaveBeenCalled()
  })

  it('calls runLint with (projectRoot, stackRoot)', async () => {
    captureIO()
    runLint.mockResolvedValue(lintResult([]))
    const root = makeProject()
    const stackRoot = '/some/stack/root'

    await lintCommand.run!(makeCtx(root, { quiet: false }, stackRoot))

    expect(runLint).toHaveBeenCalledWith(root, stackRoot)
  })
})

describe('lint — warnings only', () => {
  it('prints the warning, writes a summary to stderr, and returns without exiting', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const w = diag('warning', 'avoid this pattern')
    runLint.mockResolvedValue(lintResult([w]))
    const root = makeProject()

    await expect(lintCommand.run!(makeCtx(root, { quiet: false }, '/stack'))).resolves.toBeUndefined()

    expect(formatDiagnostic).toHaveBeenCalledWith(w)
    expect(io.stdout()).toContain('avoid this pattern')
    // Summary goes to stderr; one warning => singular.
    expect(io.stderr()).toContain('1 warning')
    expect(io.stderr()).not.toContain('error')
    expect(exit).not.toHaveBeenCalled()
  })

  it('pluralizes the warning count in the summary', async () => {
    const io = captureIO()
    runLint.mockResolvedValue(lintResult([diag('warning', 'a'), diag('warning', 'b')]))
    const root = makeProject()

    await lintCommand.run!(makeCtx(root, { quiet: false }, '/stack'))

    expect(io.stderr()).toContain('2 warnings')
  })
})

describe('lint — quiet mode', () => {
  it('filters out warnings; only error-severity diagnostics are printed', async () => {
    const io = captureIO()
    const warn = diag('warning', 'a warning message')
    const err = diag('error', 'an error message')
    runLint.mockResolvedValue(lintResult([warn, err]))
    const root = makeProject()
    const exit = mockProcessExit()

    // errorCount > 0 so it will exit(1); we only care about what was printed.
    await expect(lintCommand.run!(makeCtx(root, { quiet: true }, '/stack'))).rejects.toThrow(
      ProcessExitError,
    )

    expect(formatDiagnostic).toHaveBeenCalledWith(err)
    expect(formatDiagnostic).not.toHaveBeenCalledWith(warn)
    expect(io.stdout()).toContain('an error message')
    expect(io.stdout()).not.toContain('a warning message')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('prints nothing to stdout when quiet and only warnings exist', async () => {
    const io = captureIO()
    runLint.mockResolvedValue(lintResult([diag('warning', 'just a warning')]))
    const root = makeProject()

    await lintCommand.run!(makeCtx(root, { quiet: true }, '/stack'))

    expect(formatDiagnostic).not.toHaveBeenCalled()
    expect(io.stdout()).toBe('')
    // Summary still reports the warning on stderr.
    expect(io.stderr()).toContain('1 warning')
  })
})

describe('lint — errors present', () => {
  it('prints diagnostics then exits with code 1', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const err = diag('error', 'broken thing')
    runLint.mockResolvedValue(lintResult([err]))
    const root = makeProject()

    await expect(lintCommand.run!(makeCtx(root, { quiet: false }, '/stack'))).rejects.toThrow(
      ProcessExitError,
    )

    expect(formatDiagnostic).toHaveBeenCalledWith(err)
    expect(io.stdout()).toContain('broken thing')
    expect(io.stderr()).toContain('1 error')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('summary includes both errors and warnings, pluralized', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    runLint.mockResolvedValue(
      lintResult([
        diag('error', 'e1'),
        diag('error', 'e2'),
        diag('warning', 'w1'),
      ]),
    )
    const root = makeProject()

    await expect(lintCommand.run!(makeCtx(root, { quiet: false }, '/stack'))).rejects.toThrow(
      ProcessExitError,
    )

    expect(io.stderr()).toContain('2 errors')
    expect(io.stderr()).toContain('1 warning')
    expect(exit).toHaveBeenCalledWith(1)
  })
})
