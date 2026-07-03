import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock child_process before importing the module under test.
const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync }))

import {
  makemigrationCommand,
  migrateCommand,
  rollbackCommand,
  superuserCommand,
} from './index'

const MANAGE_PREFIX = ['compose', 'exec', 'backend', 'uv', 'run', 'python', 'manage.py']

beforeEach(() => {
  spawnSync.mockReset()
  spawnSync.mockReturnValue({ status: 0 })
})

/** A project with a Django backend (manage.py present). */
function withManagePy() {
  return makeProject({ 'backend/manage.py': '#!/usr/bin/env python\n' })
}

describe('db — manage.py guard', () => {
  it('exits 1 and explains when manage.py is missing', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ 'backend/.keep': '' })

    await expect(makemigrationCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('manage.py')
    expect(spawnSync).not.toHaveBeenCalled()
  })
})

describe('db makemigration', () => {
  it('runs manage.py makemigrations with no extra args by default', async () => {
    captureIO()
    const root = withManagePy()
    await makemigrationCommand.run!(makeCtx(root))

    expect(spawnSync).toHaveBeenCalledTimes(1)
    const [bin, args, opts] = spawnSync.mock.calls[0]!
    expect(bin).toBe('docker')
    expect(args).toEqual([...MANAGE_PREFIX, 'makemigrations'])
    expect(opts).toMatchObject({ cwd: root, stdio: 'inherit' })
  })

  it('passes the app label and --name when given', async () => {
    captureIO()
    await makemigrationCommand.run!(makeCtx(withManagePy(), { app: 'users', name: 'add_users' }))
    expect(spawnSync.mock.calls[0]![1]).toEqual([
      ...MANAGE_PREFIX,
      'makemigrations',
      'users',
      '--name',
      'add_users',
    ])
  })

  it('passes --name without an app label', async () => {
    captureIO()
    await makemigrationCommand.run!(makeCtx(withManagePy(), { name: 'tweak' }))
    expect(spawnSync.mock.calls[0]![1]).toEqual([
      ...MANAGE_PREFIX,
      'makemigrations',
      '--name',
      'tweak',
    ])
  })

  it('propagates a non-zero exit code and prints the dude up hint', async () => {
    const io = captureIO()
    const exit = mockProcessExit()
    spawnSync.mockReturnValue({ status: 3 })
    await expect(makemigrationCommand.run!(makeCtx(withManagePy()))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(3)
    expect(io.stderr()).toContain('dude up')
  })
})

describe('db migrate', () => {
  it('applies all pending migrations with --noinput by default', async () => {
    captureIO()
    await migrateCommand.run!(makeCtx(withManagePy()))
    expect(spawnSync.mock.calls[0]![1]).toEqual([...MANAGE_PREFIX, 'migrate', '--noinput'])
  })

  it('migrates a single app when --app is given', async () => {
    captureIO()
    await migrateCommand.run!(makeCtx(withManagePy(), { app: 'users' }))
    expect(spawnSync.mock.calls[0]![1]).toEqual([...MANAGE_PREFIX, 'migrate', 'users', '--noinput'])
  })

  it('migrates an app to an explicit revision', async () => {
    captureIO()
    await migrateCommand.run!(makeCtx(withManagePy(), { app: 'users', revision: '0001' }))
    expect(spawnSync.mock.calls[0]![1]).toEqual([
      ...MANAGE_PREFIX,
      'migrate',
      'users',
      '0001',
      '--noinput',
    ])
  })

  it('exits 1 when --revision is given without --app', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    await expect(migrateCommand.run!(makeCtx(withManagePy(), { revision: '0001' }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('--revision requires --app')
    expect(spawnSync).not.toHaveBeenCalled()
  })
})

describe('db rollback', () => {
  it('rolls back an app to the given migration', async () => {
    captureIO()
    await rollbackCommand.run!(makeCtx(withManagePy(), { app: 'users', to: '0001' }))
    expect(spawnSync.mock.calls[0]![1]).toEqual([
      ...MANAGE_PREFIX,
      'migrate',
      'users',
      '0001',
      '--noinput',
    ])
  })

  it('supports rolling back to zero (unapply all)', async () => {
    captureIO()
    await rollbackCommand.run!(makeCtx(withManagePy(), { app: 'users', to: 'zero' }))
    expect(spawnSync.mock.calls[0]![1]).toEqual([
      ...MANAGE_PREFIX,
      'migrate',
      'users',
      'zero',
      '--noinput',
    ])
  })

  it('exits 1 with usage examples when --to is missing', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    await expect(rollbackCommand.run!(makeCtx(withManagePy(), { app: 'users' }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('--to zero')
    expect(io.stderr()).toContain('dude db rollback --app users --to 0001')
    expect(spawnSync).not.toHaveBeenCalled()
  })

  it('exits 1 when --app is missing', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    await expect(rollbackCommand.run!(makeCtx(withManagePy(), { to: '0001' }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('--app')
    expect(spawnSync).not.toHaveBeenCalled()
  })
})

describe('db superuser', () => {
  it('runs manage.py createsuperuser interactively in the backend container', async () => {
    captureIO()
    const root = withManagePy()
    await superuserCommand.run!(makeCtx(root))

    expect(spawnSync).toHaveBeenCalledTimes(1)
    const [bin, args, opts] = spawnSync.mock.calls[0]!
    expect(bin).toBe('docker')
    expect(args).toEqual([...MANAGE_PREFIX, 'createsuperuser'])
    expect(opts).toMatchObject({ cwd: root, stdio: 'inherit' })
  })

  it('guards on manage.py like the other db commands', async () => {
    const exit = mockProcessExit()
    captureIO()
    const root = makeProject({})
    await expect(superuserCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
  })
})
