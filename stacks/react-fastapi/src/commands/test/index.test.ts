import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock child_process before importing the module under test.
const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync }))

import { testCommand } from './index'

beforeEach(() => {
  spawnSync.mockReset()
  // Default: every command is available and every exec succeeds.
  spawnSync.mockReturnValue({ status: 0, error: null })
})

/**
 * Build a spawnSync dispatcher that separates `--version` availability probes
 * from real exec calls. `available` lists the commands whose probe succeeds;
 * `execResult` is returned for non-probe (real) invocations.
 */
function dispatcher(opts: {
  available?: string[]
  execResult?: { status?: number; error?: unknown }
}) {
  const available = opts.available ?? ['uv', 'pnpm']
  const execResult = opts.execResult ?? { status: 0, error: null }
  spawnSync.mockImplementation((cmd: string, args: string[]) => {
    if (args[0] === '--version') {
      return available.includes(cmd) ? { error: null } : { error: new Error('not found') }
    }
    return { status: 0, error: null, ...execResult }
  })
}

describe('test command — preflight', () => {
  it('exits 1 when --backend requested, backend/ exists, but uv is unavailable', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'backend/.keep': '' })
    dispatcher({ available: ['pnpm'] })

    await expect(testCommand.run!(makeCtx(root, { backend: true }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('uv')
    // No real exec (pytest) should run.
    const realExec = spawnSync.mock.calls.filter((c: any[]) => c[1][0] !== '--version')
    expect(realExec).toHaveLength(0)
  })

  it('exits 1 when --e2e requested, e2e/ exists, but pnpm is unavailable', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'e2e/node_modules/': null })
    dispatcher({ available: ['uv'] })

    await expect(testCommand.run!(makeCtx(root, { e2e: true }))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('pnpm')
  })
})

describe('test command — missing directory warnings', () => {
  it('warns and passes when --backend requested but backend/ is absent', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({}) // no backend/ dir
    dispatcher({ available: [] }) // uv check is guarded by hasBackend, so this is fine

    await testCommand.run!(makeCtx(root, { backend: true }))

    expect(io.stderr()).toContain(
      'warn: --backend requested but backend/ directory not found',
    )
    expect(io.stdout()).toContain('All tests passed.')
    expect(exit).not.toHaveBeenCalled()
    // Nothing was actually executed.
    const realExec = spawnSync.mock.calls.filter((c: any[]) => c[1][0] !== '--version')
    expect(realExec).toHaveLength(0)
  })

  it('warns when --e2e requested but e2e/ is absent', async () => {
    captureIO()
    const io = captureIO()
    const root = makeProject({})
    dispatcher({ available: [] })

    await testCommand.run!(makeCtx(root, { e2e: true }))
    expect(io.stderr()).toContain('warn: --e2e requested but e2e/ directory not found')
  })
})

describe('test command — backend', () => {
  it('runs uv run pytest and reports success', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'backend/.keep': '' })
    dispatcher({})

    await testCommand.run!(makeCtx(root, { backend: true }))

    const pytest = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'uv' && c[1][0] === 'run',
    )
    expect(pytest).toBeDefined()
    expect(pytest![0]).toBe('uv')
    expect(pytest![1]).toEqual(['run', 'pytest'])
    // exec runs with cwd = backendDir.
    expect(pytest![2]).toMatchObject({ stdio: 'inherit' })
    expect(pytest![2].cwd).toContain('backend')
    expect(io.stdout()).toContain('All tests passed.')
    expect(exit).not.toHaveBeenCalled()
  })

  it('exits 1 and reports failure when pytest fails', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'backend/.keep': '' })
    dispatcher({ execResult: { status: 1, error: null } })

    await expect(testCommand.run!(makeCtx(root, { backend: true }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('Tests failed.')
  })
})

describe('test command — e2e', () => {
  it('runs pnpm run test when node_modules already present', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'e2e/node_modules/': null })
    dispatcher({})

    await testCommand.run!(makeCtx(root, { e2e: true }))

    // Install branch skipped — no pnpm install / playwright install.
    const install = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'install',
    )
    expect(install).toBeUndefined()

    const runTest = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'run',
    )
    expect(runTest).toBeDefined()
    expect(runTest![1]).toEqual(['run', 'test'])
    expect(runTest![2].cwd).toContain('e2e')
    expect(io.stdout()).toContain('All tests passed.')
    expect(exit).not.toHaveBeenCalled()
  })

  it('uses the test:report script with --report', async () => {
    captureIO()
    const root = makeProject({ 'e2e/node_modules/': null })
    dispatcher({})

    await testCommand.run!(makeCtx(root, { e2e: true, report: true }))

    const runTest = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'run',
    )
    expect(runTest![1]).toEqual(['run', 'test:report'])
  })

  it('forwards HEADED=true in env with --headed', async () => {
    captureIO()
    const root = makeProject({ 'e2e/node_modules/': null })
    dispatcher({})

    await testCommand.run!(makeCtx(root, { e2e: true, headed: true }))

    const runTest = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'run',
    )
    expect(runTest![2].env).toMatchObject({ HEADED: 'true' })
  })

  it('does not set HEADED when --headed is absent', async () => {
    captureIO()
    const root = makeProject({ 'e2e/node_modules/': null })
    dispatcher({})

    await testCommand.run!(makeCtx(root, { e2e: true }))

    const runTest = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'run',
    )
    expect(runTest![2].env?.HEADED).toBeUndefined()
  })

  it('runs pnpm install and playwright install when node_modules is missing', async () => {
    const io = captureIO()
    const root = makeProject({ 'e2e/.keep': '' }) // e2e/ exists, no node_modules
    dispatcher({})

    await testCommand.run!(makeCtx(root, { e2e: true }))

    const install = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'install',
    )
    expect(install).toBeDefined()
    const playwright = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'exec' && c[1][1] === 'playwright',
    )
    expect(playwright).toBeDefined()
    expect(io.stdout()).toContain('node_modules not found')
    expect(io.stdout()).toContain('All tests passed.')
  })
})

describe('test command — run all (no flags)', () => {
  it('runs both backend and e2e suites that are present', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'backend/.keep': '', 'e2e/node_modules/': null })
    dispatcher({})

    await testCommand.run!(makeCtx(root, {}))

    const pytest = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'uv' && c[1][0] === 'run',
    )
    const e2e = spawnSync.mock.calls.find(
      (c: any[]) => c[0] === 'pnpm' && c[1][0] === 'run',
    )
    expect(pytest).toBeDefined()
    expect(e2e).toBeDefined()
    expect(io.stdout()).toContain('All tests passed.')
    expect(exit).not.toHaveBeenCalled()
  })

  it('warns for both absent suites but still passes when no directories exist', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({})
    dispatcher({})

    await testCommand.run!(makeCtx(root, {}))

    // runAll → both suites requested; neither dir present → both warnings.
    expect(io.stderr()).toContain('warn: --backend requested but backend/ directory not found')
    expect(io.stderr()).toContain('warn: --e2e requested but e2e/ directory not found')
    // Nothing ran, so ok stays true.
    const realExec = spawnSync.mock.calls.filter((c: any[]) => c[1][0] !== '--version')
    expect(realExec).toHaveLength(0)
    expect(io.stdout()).toContain('All tests passed.')
    expect(exit).not.toHaveBeenCalled()
  })
})
