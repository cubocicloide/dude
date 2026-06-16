import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock child_process before importing the module under test.
const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync }))

import { makemigrationCommand, migrateCommand, rollbackCommand } from './index'

beforeEach(() => {
  spawnSync.mockReset()
  spawnSync.mockReturnValue({ status: 0 })
})

/** A project with a Postgres/Alembic setup. */
function withAlembic() {
  return makeProject({ 'backend/alembic.ini': '[alembic]\n' })
}

describe('db — requiresAlembic guard', () => {
  it('exits 1 and explains when alembic.ini is missing', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'backend/.keep': '' })

    await expect(makemigrationCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('No Alembic configuration found')
    expect(spawnSync).not.toHaveBeenCalled()
  })
})

describe('db makemigration', () => {
  it('runs alembic revision --autogenerate with the message', async () => {
    captureIO()
    const root = withAlembic()
    await makemigrationCommand.run!(makeCtx(root, { message: 'add users' }))

    expect(spawnSync).toHaveBeenCalledTimes(1)
    const [bin, args, opts] = spawnSync.mock.calls[0]!
    expect(bin).toBe('docker')
    expect(args).toEqual([
      'compose',
      'exec',
      'backend',
      'uv',
      'run',
      'alembic',
      'revision',
      '--autogenerate',
      '-m',
      'add users',
    ])
    expect(opts).toMatchObject({ cwd: root, stdio: 'inherit' })
  })

  it('defaults the message to "auto"', async () => {
    captureIO()
    await makemigrationCommand.run!(makeCtx(withAlembic()))
    expect(spawnSync.mock.calls[0]![1]).toContain('auto')
  })

  it('propagates a non-zero exit code', async () => {
    captureIO()
    const exit = mockProcessExit()
    spawnSync.mockReturnValue({ status: 3 })
    await expect(makemigrationCommand.run!(makeCtx(withAlembic()))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(3)
  })
})

describe('db migrate', () => {
  it('upgrades to head by default', async () => {
    captureIO()
    await migrateCommand.run!(makeCtx(withAlembic()))
    expect(spawnSync.mock.calls[0]![1]).toEqual([
      'compose',
      'exec',
      'backend',
      'uv',
      'run',
      'alembic',
      'upgrade',
      'head',
    ])
  })

  it('upgrades to an explicit revision', async () => {
    captureIO()
    await migrateCommand.run!(makeCtx(withAlembic(), { revision: 'abc123' }))
    expect(spawnSync.mock.calls[0]![1]).toContain('abc123')
  })
})

describe('db rollback', () => {
  it('downgrades by -1 by default', async () => {
    captureIO()
    await rollbackCommand.run!(makeCtx(withAlembic()))
    expect(spawnSync.mock.calls[0]![1]).toEqual([
      'compose',
      'exec',
      'backend',
      'uv',
      'run',
      'alembic',
      'downgrade',
      '-1',
    ])
  })
})
