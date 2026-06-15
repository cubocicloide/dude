/**
 * Integration test: scaffold option matrix.
 *
 * Drives the real `dude init` CLI (via the Project helper) for each
 * combination of stack options, then verifies — from a customer's point of
 * view — that:
 *
 *   1. the right template overlays were applied (and the disabled ones were not),
 *   2. docker-compose.yml gained exactly the services the options imply, and
 *   3. `dude lint` exits 0 on the freshly-scaffolded project.
 *
 * This is the only place the postgres/celery/celerybeat overlays and their
 * `withPostgres`/`withCelery`/`withRedis` Handlebars conditionals are exercised
 * end-to-end. Unit tests cover individual lint rules; this proves the variants
 * a user can actually select all scaffold into a lint-clean project.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from '@cubocicloide/dude/testing'

interface Variant {
  /** Suite label and tmpdir prefix. */
  name: string
  /** Flags appended after `--yes` when invoking `dude init`. */
  flags: string[]
  /** Files that must exist (overlay was applied). */
  present: string[]
  /** Files that must NOT exist (overlay was skipped). */
  absent: string[]
  /** Service/section markers that must appear in docker-compose.yml. */
  composeIncludes: string[]
  /** Markers that must NOT appear in docker-compose.yml. */
  composeExcludes: string[]
}

const POSTGRES_FILES = ['backend/app/models/user.py', 'backend/alembic.ini']
const CELERY_FILES = ['backend/app/worker.py', 'backend/app/tasks/example.py']
const CELERYBEAT_FILES = ['backend/app/tasks/scheduled.py']

const VARIANTS: Variant[] = [
  {
    name: 'base',
    flags: [],
    present: [],
    absent: [...POSTGRES_FILES, ...CELERY_FILES, ...CELERYBEAT_FILES],
    composeIncludes: [],
    composeExcludes: ['postgres:', 'redis:', 'celery_worker:', 'celery_beat:'],
  },
  {
    name: 'postgres',
    flags: ['--database', 'postgres'],
    present: POSTGRES_FILES,
    absent: [...CELERY_FILES, ...CELERYBEAT_FILES],
    composeIncludes: ['postgres:'],
    composeExcludes: ['redis:', 'celery_worker:', 'celery_beat:'],
  },
  {
    name: 'celery',
    flags: ['--celery'],
    present: CELERY_FILES,
    absent: [...POSTGRES_FILES, ...CELERYBEAT_FILES],
    // Celery implies Redis as broker/result backend.
    composeIncludes: ['redis:', 'celery_worker:'],
    composeExcludes: ['postgres:', 'celery_beat:'],
  },
  {
    name: 'celerybeat',
    flags: ['--celeryBeat'],
    // Celery Beat auto-enables Celery, so both overlays land.
    present: [...CELERY_FILES, ...CELERYBEAT_FILES],
    absent: POSTGRES_FILES,
    composeIncludes: ['redis:', 'celery_worker:', 'celery_beat:'],
    composeExcludes: ['postgres:'],
  },
  {
    name: 'full',
    flags: ['--database', 'postgres', '--celeryBeat'],
    present: [...POSTGRES_FILES, ...CELERY_FILES, ...CELERYBEAT_FILES],
    absent: [],
    composeIncludes: ['postgres:', 'redis:', 'celery_worker:', 'celery_beat:'],
    composeExcludes: [],
  },
]

describe.each(VARIANTS)('scaffold variant: $name', (variant) => {
  let project: Project

  beforeAll(() => {
    project = Project.scaffold({
      prefix: `dude-${variant.name}-`,
      flags: ['--yes', ...variant.flags],
    })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('applies the enabled overlays', () => {
    for (const file of variant.present) {
      expect(project.exists(file), `expected ${file} to exist`).toBe(true)
    }
  })

  it('omits the disabled overlays', () => {
    for (const file of variant.absent) {
      expect(project.exists(file), `expected ${file} to be absent`).toBe(false)
    }
  })

  it('renders docker-compose.yml with the right services', () => {
    const compose = project.readFile('docker-compose.yml')
    for (const marker of variant.composeIncludes) {
      expect(compose, `compose should contain "${marker}"`).toContain(marker)
    }
    for (const marker of variant.composeExcludes) {
      expect(compose, `compose should not contain "${marker}"`).not.toContain(marker)
    }
  })

  it('passes `dude lint` on the fresh scaffold', () => {
    const result = project.run('lint')
    if (result.status !== 0) process.stdout.write(result.stdout + result.stderr + '\n')
    expect(result.status).toBe(0)
  })
})
