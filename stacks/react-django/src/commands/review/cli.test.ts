/**
 * CLI integration test: `dude review` (react-django stack)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isAvailable, Project } from '@cubocicloide/dude/testing'

const PNPM_AVAILABLE = isAvailable('pnpm')

let project: Project

describe('dude review', () => {
  beforeAll(() => {
    project = Project.scaffold({ stack: './stacks/react-django', prefix: 'dude-review-' })
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

  // NOTE: violation-triggering cases live in lint/cli.test.ts, next to the
  // checks they exercise — review only wraps `dude lint`, so a generic
  // smoke test of the lint section is enough here.

  it.skipIf(!PNPM_AVAILABLE)('ESLint section runs when pnpm is available', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/eslint/i)
  })

  it.skipIf(PNPM_AVAILABLE)('ESLint section emits a warning when pnpm is absent', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/pnpm/i)
  })
})
