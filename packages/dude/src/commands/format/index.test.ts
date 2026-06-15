/**
 * Integration test: `dude format`
 *
 * Tests CLI-level behaviour: exit codes, --check flag, and that both
 * Python (ruff) and TypeScript (prettier) formatters are invoked.
 *
 * Prerequisites:
 *   uv   — Python formatting (ruff). Skipped gracefully if absent.
 *   pnpm — TypeScript formatting (prettier). Skipped gracefully if absent.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { isAvailable, Project } from '../../utils/testing.js'

const UV_AVAILABLE = isAvailable('uv')
const PNPM_AVAILABLE = isAvailable('pnpm')

let project: Project

describe('dude format', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-format-' })

    // Install backend deps so `uv run ruff` works inside the project.
    if (UV_AVAILABLE) {
      spawnSync('uv', ['sync'], {
        cwd: join(project.dir, 'backend'),
        stdio: 'pipe',
        shell: true,
      })
    }

    // Install frontend deps so prettier works inside the project.
    if (PNPM_AVAILABLE) {
      spawnSync('pnpm', ['install'], {
        cwd: join(project.dir, 'frontend'),
        stdio: 'pipe',
        shell: true,
      })
    }
  }, 180_000)

  afterAll(() => project.cleanup())

  // ── Baseline ─────────────────────────────────────────────────────────────

  it.skipIf(!UV_AVAILABLE || !PNPM_AVAILABLE)(
    'format --check exits 0 on a well-formatted scaffold',
    () => {
      // Run format --write first to guarantee the scaffold is clean, then check.
      project.run('format')
      expect(project.run('format', '--check').status).toBe(0)
    },
  )

  // ── Python formatting ─────────────────────────────────────────────────────

  it.skipIf(!UV_AVAILABLE)('format --check exits 1 on a badly-formatted .py file', () => {
    project.write(
      'backend/app/utils/bad.py',
      '"""Bad formatting."""\nx=1\ny   =   2\n',
    )
    expect(project.run('format', '--check').status).toBe(1)
    project.restore('backend/app/utils/bad.py')
  })

  it.skipIf(!UV_AVAILABLE)('format (write) fixes a badly-formatted .py file', () => {
    project.write('backend/app/utils/bad.py', '"""Bad."""\nx=1\n')
    expect(project.run('format').status).toBe(0)
    expect(project.run('format', '--check').status).toBe(0)
    project.restore('backend/app/utils/bad.py')
  })

  // ── TypeScript formatting ─────────────────────────────────────────────────

  it.skipIf(!PNPM_AVAILABLE)(
    'format --check exits 1 on a badly-formatted .ts file',
    () => {
      project.write(
        'frontend/src/bad.ts',
        'export const x=1\nexport const y   =   2\n',
      )
      expect(project.run('format', '--check').status).toBe(1)
      project.restore('frontend/src/bad.ts')
    },
  )

  it.skipIf(!PNPM_AVAILABLE)('format (write) fixes a badly-formatted .ts file', () => {
    project.write('frontend/src/bad.ts', 'export const x=1\n')
    expect(project.run('format').status).toBe(0)
    expect(project.run('format', '--check').status).toBe(0)
    project.restore('frontend/src/bad.ts')
  })
})
