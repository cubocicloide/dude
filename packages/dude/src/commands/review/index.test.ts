/**
 * Integration test: `dude review`
 *
 * `dude review` runs three sections in sequence:
 *   1. dude lint   — structural checks (no external tools)
 *   2. ESLint      — TypeScript linting (skipped with a warning if pnpm absent)
 *   3. api review  — OpenAPI contract check
 *
 * Known limitation: `dude api review` requires openapi.yaml which is only
 * generated after `dude api sync` against a live backend. On a fresh scaffold
 * this file is absent, so `dude review` always exits 1 on that section.
 * We test what is testable without a running stack.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isAvailable, Project } from '../../utils/testing.js'

const PNPM_AVAILABLE = isAvailable('pnpm')

let project: Project

describe('dude review', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-review-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  // ── lint section always runs ──────────────────────────────────────────────

  it('lint section runs and produces output', () => {
    const r = project.run('review')
    // Output always mentions "dude lint" regardless of ESLint / api availability.
    expect(r.stdout + r.stderr).toMatch(/lint/)
  })

  it('lint section is clean on a fresh scaffold', () => {
    const r = project.run('review')
    // The lint section should not report any lint errors on a clean scaffold.
    expect(r.stdout + r.stderr).not.toMatch(/error [A-Z]{2}\d{3}/)
  })

  // ── lint violation is surfaced ────────────────────────────────────────────

  it('lint section catches a violation introduced in the project', () => {
    project.remove('backend/app/fixtures')
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/BE001/)
    project.restore('backend/app/fixtures')
  })

  // ── ESLint section ────────────────────────────────────────────────────────

  it.skipIf(!PNPM_AVAILABLE)('ESLint section runs when pnpm is available', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/eslint/i)
  })

  it.skipIf(PNPM_AVAILABLE)('ESLint section emits a warning when pnpm is absent', () => {
    const r = project.run('review')
    expect(r.stdout + r.stderr).toMatch(/pnpm/i)
  })
})
