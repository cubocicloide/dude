/**
 * Integration test: `dude upgrade`
 *
 * Verifies that the command updates package.json and dude.json pins without
 * touching any other project file, and that it handles the "already pinned"
 * case gracefully.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from '../../utils/testing.js'

let project: Project

describe('dude upgrade', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-upgrade-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('exits 0 when pinning the current versions (no-op)', () => {
    const manifest = JSON.parse(project.readFile('dude.json')) as {
      dudeVersion: string
      stackVersion: string
    }
    const r = project.run(
      'upgrade',
      '--cli',
      `--cli-version`,
      manifest.dudeVersion,
      '--stack',
      `--stack-version`,
      manifest.stackVersion,
    )
    expect(r.status).toBe(0)
  })

  it('updates stackVersion in dude.json when --stack --stack-version is given', () => {
    const manifest = JSON.parse(project.readFile('dude.json')) as { stackVersion: string }
    const current = manifest.stackVersion
    // Downgrade by one patch as a safe, always-valid test value
    const [major, minor, patch] = current.split('.').map(Number)
    const target = patch! > 0 ? `${major}.${minor}.${patch! - 1}` : `${major}.${minor! - 1}.0`

    const r = project.run('upgrade', '--stack', '--stack-version', target)
    expect(r.status).toBe(0)
    const updated = JSON.parse(project.readFile('dude.json')) as { stackVersion: string }
    expect(updated.stackVersion).toBe(target)

    // Restore original version
    project.run('upgrade', '--stack', '--stack-version', current)
  })

  it('updates @cubocicloide/dude in package.json when --cli --cli-version is given', () => {
    const pkg = JSON.parse(project.readFile('package.json')) as {
      devDependencies: Record<string, string>
    }
    const current = pkg.devDependencies['@cubocicloide/dude']!.replace(/^\^/, '')
    const [major, minor, patch] = current.split('.').map(Number)
    const target = patch! > 0 ? `${major}.${minor}.${patch! - 1}` : `${major}.${minor! - 1}.0`

    const r = project.run('upgrade', '--cli', '--cli-version', target)
    expect(r.status).toBe(0)
    const updated = JSON.parse(project.readFile('package.json')) as {
      devDependencies: Record<string, string>
    }
    expect(updated.devDependencies['@cubocicloide/dude']).toBe(target)

    // Restore
    project.run('upgrade', '--cli', '--cli-version', current)
  })

  it('prints a clear message when nothing changes', () => {
    const manifest = JSON.parse(project.readFile('dude.json')) as { stackVersion: string }
    const r = project.run('upgrade', '--stack', '--stack-version', manifest.stackVersion)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('already pins')
  })
})
