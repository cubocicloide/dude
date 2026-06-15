import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock the runtime helpers and child_process before importing the module under test.
const { runLint, formatDiagnostic } = vi.hoisted(() => ({
  runLint: vi.fn(),
  formatDiagnostic: vi.fn(),
}))
vi.mock('@cubocicloide/dude', () => ({ runLint, formatDiagnostic }))

const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync }))

import { reviewCommand } from './index'

beforeEach(() => {
  spawnSync.mockReset()
  // Default: every spawnSync call succeeds (available probes + execs).
  spawnSync.mockReturnValue({ status: 0, error: undefined })
  runLint.mockResolvedValue({ diagnostics: [], errorCount: 0, warningCount: 0 })
  formatDiagnostic.mockImplementation((d: { message: string }) => d.message)
})

describe('review — preflight', () => {
  it('exits 1 when frontend present and pnpm is missing', async () => {
    spawnSync.mockImplementation((cmd: string, args: string[] = []) => {
      if (args.length === 1 && args[0] === '--version') {
        if (cmd === 'pnpm') return { error: new Error('ENOENT') }
        return { status: 0, error: undefined }
      }
      return { status: 0, error: undefined }
    })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'frontend/.keep': '' })

    await expect(reviewCommand.run!(makeCtx(root, {}, 'stack'))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('pnpm')
    expect(io.stderr()).toContain('required tools not found')
  })

  it('exits 1 when e2e present and pnpm is missing', async () => {
    spawnSync.mockImplementation((cmd: string, args: string[] = []) => {
      if (args.length === 1 && args[0] === '--version') {
        if (cmd === 'pnpm') return { error: new Error('ENOENT') }
        return { status: 0, error: undefined }
      }
      return { status: 0, error: undefined }
    })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'e2e/.keep': '' })

    await expect(reviewCommand.run!(makeCtx(root, {}, 'stack'))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('pnpm')
  })
})

describe('review — happy path', () => {
  it('prints "All checks passed." and returns normally with no frontend/e2e dirs', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'README.md': '# project' })

    await reviewCommand.run!(makeCtx(root, {}, 'stack'))

    expect(exit).not.toHaveBeenCalled()
    expect(io.stdout()).toContain('No issues found.')
    expect(io.stdout()).toContain('All checks passed.')

    // runLint was invoked with (projectRoot, stackRoot).
    expect(runLint).toHaveBeenCalledWith(root, 'stack')

    // `dude api review` was run via exec().
    const apiCall = spawnSync.mock.calls.find(
      ([cmd, args]) => cmd === 'dude' && Array.isArray(args) && args[0] === 'api' && args[1] === 'review',
    )
    expect(apiCall).toBeTruthy()

    // No pnpm/eslint calls, since frontend/ and e2e/ are absent.
    const eslintCall = spawnSync.mock.calls.find(([cmd]) => cmd === 'pnpm')
    expect(eslintCall).toBeFalsy()
  })

  it('prints formatted diagnostics when runLint returns some (no errors)', async () => {
    runLint.mockResolvedValue({
      diagnostics: [{ message: 'just a warning', severity: 'warning' }],
      errorCount: 0,
      warningCount: 1,
    })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'README.md': '# project' })

    await reviewCommand.run!(makeCtx(root, {}, 'stack'))

    expect(exit).not.toHaveBeenCalled()
    expect(formatDiagnostic).toHaveBeenCalled()
    expect(io.stdout()).toContain('just a warning')
    expect(io.stdout()).toContain('All checks passed.')
  })
})

describe('review — failure paths', () => {
  it('exits 1 when runLint reports errors', async () => {
    runLint.mockResolvedValue({
      diagnostics: [{ message: 'bad thing', severity: 'error' }],
      errorCount: 2,
      warningCount: 0,
    })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'README.md': '# project' })

    await expect(reviewCommand.run!(makeCtx(root, {}, 'stack'))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('Review failed.')
  })

  it('exits 1 when `dude api review` exec fails', async () => {
    spawnSync.mockImplementation((cmd: string, args: string[] = []) => {
      if (args.length === 1 && args[0] === '--version') return { status: 0, error: undefined }
      if (cmd === 'dude' && args[0] === 'api' && args[1] === 'review') {
        return { status: 1, error: undefined }
      }
      return { status: 0, error: undefined }
    })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'README.md': '# project' })

    await expect(reviewCommand.run!(makeCtx(root, {}, 'stack'))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('Review failed.')
  })
})
