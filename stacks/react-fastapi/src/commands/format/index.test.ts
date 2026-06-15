import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock child_process before importing the module under test.
const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync }))

import { formatCommand } from './index'

/** A dispatcher returning per-(cmd, subcommand) results. */
interface DispatchOpts {
  uvAvailable?: boolean
  pnpmAvailable?: boolean
  backendServiceRunning?: boolean
  /** status returned by real exec() invocations (default 0 = success). */
  execStatus?: number
}

function installDispatcher(opts: DispatchOpts = {}) {
  const {
    uvAvailable = true,
    pnpmAvailable = true,
    backendServiceRunning = false,
    execStatus = 0,
  } = opts

  spawnSync.mockImplementation((cmd: string, args: string[] = []) => {
    // isAvailable(cmd) → spawnSync(cmd, ['--version'])
    if (args.length === 1 && args[0] === '--version') {
      if (cmd === 'uv') return uvAvailable ? { status: 0, error: undefined } : { error: new Error('ENOENT') }
      if (cmd === 'pnpm')
        return pnpmAvailable ? { status: 0, error: undefined } : { error: new Error('ENOENT') }
      return { status: 0, error: undefined }
    }

    // isDockerServiceRunning → spawnSync('docker', ['compose', 'ps', ...])
    if (cmd === 'docker' && args[0] === 'compose' && args[1] === 'ps') {
      return {
        status: 0,
        error: undefined,
        stdout: Buffer.from(backendServiceRunning ? 'abc123\n' : ''),
      }
    }

    // Any other call is a real exec().
    return { status: execStatus, error: undefined }
  })
}

beforeEach(() => {
  spawnSync.mockReset()
})

describe('format — preflight', () => {
  it('exits 1 when backend present, container down, and uv missing', async () => {
    installDispatcher({ uvAvailable: false, backendServiceRunning: false })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'backend/.keep': '' })

    await expect(formatCommand.run!(makeCtx(root, { check: true }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('uv')
    expect(io.stderr()).toContain('required')
  })

  it('exits 1 when frontend present and pnpm missing', async () => {
    installDispatcher({ pnpmAvailable: false })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'frontend/.keep': '' })

    await expect(formatCommand.run!(makeCtx(root, { check: true }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('pnpm')
  })

  it('exits 1 when e2e present and pnpm missing', async () => {
    installDispatcher({ pnpmAvailable: false })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'e2e/.keep': '' })

    await expect(formatCommand.run!(makeCtx(root, { check: true }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('pnpm')
  })
})

describe('format — frontend happy path', () => {
  it('runs prettier --check without installing or exiting', async () => {
    installDispatcher({ pnpmAvailable: true, execStatus: 0 })
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({
      'frontend/package.json': '{}',
      'frontend/node_modules/.bin/prettier': '#!/bin/sh\n',
    })

    await formatCommand.run!(makeCtx(root, { check: true }))

    expect(exit).not.toHaveBeenCalled()
    expect(io.stdout()).toContain('Checking frontend formatting')

    // pnpm exec prettier --check src/  (no install, since node_modules/.bin/prettier exists)
    const prettierCall = spawnSync.mock.calls.find(
      ([cmd, args]) => cmd === 'pnpm' && Array.isArray(args) && args.includes('prettier'),
    )
    expect(prettierCall).toBeTruthy()
    const [, args] = prettierCall!
    expect(args).toContain('prettier')
    expect(args).toContain('--check')

    // ensureNodeModules must NOT have run an install.
    const installCall = spawnSync.mock.calls.find(
      ([cmd, a]) => cmd === 'pnpm' && Array.isArray(a) && a[0] === 'install',
    )
    expect(installCall).toBeFalsy()
  })
})

describe('format — frontend failure path', () => {
  it('exits 1 when prettier reports formatting differences', async () => {
    installDispatcher({ pnpmAvailable: true, execStatus: 1 })
    const exit = mockProcessExit()
    captureIO()
    const root = makeProject({
      'frontend/package.json': '{}',
      'frontend/node_modules/.bin/prettier': '#!/bin/sh\n',
    })

    await expect(formatCommand.run!(makeCtx(root, { check: true }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
  })
})
