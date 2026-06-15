/**
 * CLI integration test: `dude review` (react-fastapi stack)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isAvailable, Project } from '@cubocicloide/dude/testing'

const PNPM_AVAILABLE = isAvailable('pnpm')

let project: Project

describe('dude review', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-review-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('lint section runs and produces output', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/lint/)
  })

  it('lint section is clean on a fresh scaffold', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).not.toMatch(/error [A-Z]{2}\d{3}/)
  })

  it('lint section catches a violation introduced in the project', () => {
    project.remove('backend/app/fixtures')
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/BE001/)
    project.restore('backend/app/fixtures')
  })

  it.skipIf(!PNPM_AVAILABLE)('ESLint section runs when pnpm is available', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/eslint/i)
  })

  it.skipIf(PNPM_AVAILABLE)('ESLint section emits a warning when pnpm is absent', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/pnpm/i)
  })
})
