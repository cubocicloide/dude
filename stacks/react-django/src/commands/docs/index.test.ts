import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock child_process before importing the module under test.
const { spawnSync, spawn } = vi.hoisted(() => ({ spawnSync: vi.fn(), spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync, spawn }))

import { docsCommand } from './index'

/** A fake long-running child whose `close` event fires immediately with code 0. */
function fakeChild(pid: number | null = 123) {
  return {
    pid,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: (event: string, cb: (code: number) => void) => {
      if (event === 'close') cb(0)
    },
  }
}

beforeEach(() => {
  spawnSync.mockReset()
  spawn.mockReset()
  // Default: Docker is running.
  spawnSync.mockReturnValue({ status: 0, error: null })
  // Default: spawn returns a healthy child that closes immediately.
  spawn.mockReturnValue(fakeChild())
})

/** A project that has a docs/ folder. */
function withDocs() {
  return makeProject({ 'docs/index.md': '# Docs\n' })
}

describe('docs — docs/ folder guard', () => {
  it('exits 1 and explains when docs/ folder is missing', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'README.md': '' })

    await expect(docsCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('No docs/ folder found')
    expect(spawn).not.toHaveBeenCalled()
  })
})

describe('docs — Docker health check', () => {
  it('exits 1 when Docker is not running (non-zero status)', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    spawnSync.mockReturnValue({ status: 1, error: null })

    await expect(docsCommand.run!(makeCtx(withDocs()))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('Docker is not running')
    expect(spawnSync).toHaveBeenCalledWith('docker', ['info'], expect.anything())
    expect(spawn).not.toHaveBeenCalled()
  })

  it('exits 1 when the docker info call errors', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    spawnSync.mockReturnValue({ status: 0, error: new Error('ENOENT') })

    await expect(docsCommand.run!(makeCtx(withDocs()))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('Docker is not running')
    expect(spawn).not.toHaveBeenCalled()
  })
})

describe('docs — happy path', () => {
  it('starts MkDocs and runs docker with the expected args', async () => {
    const io = captureIO()
    const root = withDocs()

    await docsCommand.run!(makeCtx(root))

    expect(io.stdout()).toContain('Starting MkDocs')
    expect(io.stdout()).toContain('http://localhost:8001')

    expect(spawn).toHaveBeenCalledTimes(1)
    const [bin, args] = spawn.mock.calls[0]!
    expect(bin).toBe('docker')
    expect(args).toContain('run')
    expect(args).toContain('--rm')
    // Default port mapping.
    expect(args).toContain('8001:8000')
    // Docs dir volume mount.
    expect(args).toContain(`${root}/docs:/docs`)
    expect(args).toContain('squidfunk/mkdocs-material')
    expect(args).toContain('serve')
  })

  it('honors a custom --port for both the URL and the port mapping', async () => {
    const io = captureIO()
    const root = withDocs()

    await docsCommand.run!(makeCtx(root, { port: '9000' }))

    expect(io.stdout()).toContain('http://localhost:9000')
    const [, args] = spawn.mock.calls[0]!
    expect(args).toContain('9000:8000')
  })
})

describe('docs — container failed to start', () => {
  it('exits 1 when spawn returns a child with no pid', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    spawn.mockReturnValue(fakeChild(null))

    await expect(docsCommand.run!(makeCtx(withDocs()))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('Failed to start')
  })
})
