/**
 * Integration test: `dude info`
 *
 * Verifies the command prints a diagnostics report — always the CLI version and
 * environment lines, plus the pinned stack + scaffold answers when run inside a
 * project. It must never crash, even when optional tools are missing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Project, REPO_ROOT, runCLI } from '../../utils/testing.js'

const DUDE_PKG = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'packages/dude/package.json'), 'utf8'),
) as { version: string }

let project: Project

describe('dude info', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-info-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('exits 0 outside a project', () => {
    expect(runCLI(['info']).status).toBe(0)
  })

  it('prints the CLI version and environment lines outside a project', () => {
    const r = runCLI(['info'])
    expect(r.stdout).toContain(DUDE_PKG.version)
    expect(r.stdout).toContain('OS:')
    expect(r.stdout).toContain('Node:')
  })

  it('prints the stack version and scaffold answers inside a project', () => {
    const r = project.run('info')
    expect(r.status).toBe(0)
    const manifest = JSON.parse(project.readFile('dude.json')) as { stackVersion: string }
    expect(r.stdout).toContain(manifest.stackVersion)
    expect(r.stdout).toContain('Scaffold answers:')
  })
})
