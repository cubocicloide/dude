/**
 * Integration test: `dude init`
 *
 * Verifies that scaffolding produces the expected directory structure,
 * writes a valid dude.json manifest, and (when uv is available) that the
 * generated backend test suite passes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { Project } from '../../utils/testing.js'

const UV_AVAILABLE = spawnSync('uv', ['--version'], { stdio: 'ignore' }).error == null

let project: Project

describe('dude init', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-init-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  // ── Directory structure ──────────────────────────────────────────────────

  it('creates backend/', () => expect(project.exists('backend')).toBe(true))
  it('creates frontend/', () => expect(project.exists('frontend')).toBe(true))
  it('creates e2e/', () => expect(project.exists('e2e')).toBe(true))
  it('creates docker-compose.yml', () => expect(project.exists('docker-compose.yml')).toBe(true))
  it('creates .gitignore', () => expect(project.exists('.gitignore')).toBe(true))

  // ── dude.json manifest ───────────────────────────────────────────────────

  it('writes a valid dude.json', () => {
    expect(project.exists('dude.json')).toBe(true)
    const m = JSON.parse(project.readFile('dude.json')) as Record<string, unknown>
    expect(m['stack']).toBe('@cubocicloide/stack-react-fastapi')
    expect(typeof (m['answers'] as Record<string, unknown>)['projectName']).toBe('string')
    expect(String((m['answers'] as Record<string, unknown>)['projectName']).length).toBeGreaterThan(
      0,
    )
    expect(String(m['stackVersion'])).toMatch(/^\d+\.\d+\.\d+/)
    expect(String(m['dudeVersion'])).toMatch(/^\d+\.\d+\.\d+/)
    expect(() => new Date(String(m['generatedAt']))).not.toThrow()
  })

  // ── Backend test suite ───────────────────────────────────────────────────
  // Runs the generated project's own pytest to prove the scaffold is healthy,
  // not just structurally present.

  it.skipIf(!UV_AVAILABLE)(
    'backend pytest passes on the fresh scaffold',
    () => {
      const r = project.run('test', '--backend')
      if (r.status !== 0) process.stdout.write(r.stdout + r.stderr + '\n')
      expect(r.status).toBe(0)
      expect(r.stdout).toMatch(/All tests passed\./)
    },
    300_000,
  )
})

// Stack variables can be answered non-interactively through CLI flags. A
// value-taking flag (`--database postgres`) and a bare boolean switch
// (`--celery`) must both be recorded — and the trailing positional directory
// must survive the boolean switch immediately before it.
describe('dude init — variable flags', () => {
  let project: Project
  beforeAll(() => {
    project = Project.scaffold({
      prefix: 'dude-init-flags-',
      flags: ['--yes', '--database', 'postgres', '--celery'],
    })
  }, 60_000)
  afterAll(() => project.cleanup())

  it('records flag answers in dude.json', () => {
    const answers = (
      JSON.parse(project.readFile('dude.json')) as { answers: Record<string, unknown> }
    ).answers
    expect(answers['database']).toBe('postgres')
    expect(answers['celery']).toBe(true)
  })

  it('still scaffolds into the positional directory after a boolean flag', () => {
    // If the dir had been swallowed by `--celery`, none of these would exist.
    expect(project.exists('dude.json')).toBe(true)
    expect(project.exists('backend')).toBe(true)
  })
})
