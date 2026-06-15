/**
 * Integration test: `dude version`
 *
 * Verifies the command outputs the CLI version and — when run inside a
 * project directory — also the pinned stack version from dude.json.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Project, REPO_ROOT, runCLI } from '../../utils/testing.js'

const DUDE_PKG = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'packages/dude/package.json'), 'utf8'),
) as { version: string }

let project: Project

describe('dude version', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-version-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('exits 0 outside a project', () => {
    expect(runCLI(['version']).status).toBe(0)
  })

  it('prints the CLI version outside a project', () => {
    const r = runCLI(['version'])
    expect(r.stdout).toContain(DUDE_PKG.version)
  })

  it('prints the stack version inside a project', () => {
    const r = project.run('version')
    expect(r.status).toBe(0)
    const manifest = JSON.parse(project.readFile('dude.json')) as { stackVersion: string }
    expect(r.stdout).toContain(manifest.stackVersion)
  })
})
