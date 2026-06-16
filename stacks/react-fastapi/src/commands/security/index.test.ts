import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'

// Mock child_process before importing the module under test.
const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync }))

import { securityScanCommand, securityAcceptCommand, securityVerifyCommand } from './index'

beforeEach(() => {
  spawnSync.mockReset()
  // `docker info` succeeds; scanners "succeed" but never write a report file,
  // so the runner logs a warning and proceeds with zero findings.
  spawnSync.mockReturnValue({ status: 0 })
})

/** A minimal project with a backend dir to scan. */
function project() {
  return makeProject({ 'backend/.keep': '' })
}

const reportsRoot = (root: string) => path.join(root, 'private', 'sast-reports')
const latestDir = (root: string) => path.join(reportsRoot(root), 'latest')
const baselineFile = (root: string) => path.join(root, 'security', 'baseline.json')

describe('security — ensureDocker guard', () => {
  it('exits 2 when `docker info` returns a non-zero status', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = project()
    spawnSync.mockReturnValue({ status: 1 })

    await expect(securityScanCommand.run!(makeCtx(root, { only: 'bandit' }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(2)
    expect(io.stderr()).toContain('docker is required but is not available')
  })

  it('exits 2 when spawnSync reports an error', async () => {
    const exit = mockProcessExit()
    captureIO()
    const root = project()
    spawnSync.mockReturnValue({ status: 0, error: new Error('ENOENT') })

    await expect(securityScanCommand.run!(makeCtx(root, { only: 'bandit' }))).rejects.toThrow(
      ProcessExitError,
    )
    expect(exit).toHaveBeenCalledWith(2)
  })
})

describe('security scan', () => {
  it('writes reports and prints the summary with no new findings', async () => {
    const io = captureIO()
    const root = project()

    // No exit expected: zero findings → exitCode 0.
    await securityScanCommand.run!(makeCtx(root, { only: 'bandit' }))

    const latest = latestDir(root)
    expect(existsSync(path.join(latest, 'summary.md'))).toBe(true)
    expect(existsSync(path.join(latest, 'findings.json'))).toBe(true)

    const summary = readFileSync(path.join(latest, 'summary.md'), 'utf8')
    expect(summary).toContain('# Security scan summary')
    expect(summary).toContain('No new findings at severity ≥ MEDIUM.')

    // The command echoes the latest summary.md to stdout.
    expect(io.stdout()).toContain('No new findings at severity ≥ MEDIUM.')

    // findings.json records zero findings.
    const findings = JSON.parse(readFileSync(path.join(latest, 'findings.json'), 'utf8'))
    expect(findings.count).toBe(0)
    expect(findings.findings).toEqual([])
  })
})

describe('security accept', () => {
  it('writes the baseline file and reports it was saved', async () => {
    const io = captureIO()
    const root = project()

    await securityAcceptCommand.run!(makeCtx(root, { only: 'bandit' }))

    const baseline = baselineFile(root)
    expect(existsSync(baseline)).toBe(true)
    expect(io.stdout()).toContain('Baseline saved')

    // Empty findings → empty entries map, but the file is still written.
    const data = JSON.parse(readFileSync(baseline, 'utf8'))
    expect(data.entries).toEqual({})
  })
})

describe('security verify', () => {
  it('exits 1 and prints stats when baseline is empty and nothing is resolved', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = project()

    await expect(securityVerifyCommand.run!(makeCtx(root, { only: 'bandit' }))).rejects.toThrow(
      ProcessExitError,
    )
    // resolved.length === 0 → allFixed false → exit(1).
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stdout()).toContain('Resolved fingerprints : 0')
    expect(io.stdout()).toContain('Still present (known) : 0')
    expect(io.stdout()).toContain('New (not in baseline) : 0')
  })
})
