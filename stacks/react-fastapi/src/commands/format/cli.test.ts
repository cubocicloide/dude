/**
 * CLI integration test: `dude format` (react-fastapi stack)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { isAvailable, Project } from '@cubocicloide/dude/testing'

const UV_AVAILABLE = isAvailable('uv')
const PNPM_AVAILABLE = isAvailable('pnpm')

let project: Project

describe('dude format', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-format-' })

    if (UV_AVAILABLE) {
      spawnSync('uv', ['sync'], { cwd: join(project.dir, 'backend'), stdio: 'pipe', shell: true })
    }
    // Install both frontend and e2e so the format command finds the prettier
    // binary without triggering pnpm workspace detection on the project root.
    for (const sub of ['frontend', 'e2e']) {
      spawnSync('npm', ['install', '--prefix', join(project.dir, sub), '--silent'], {
        cwd: join(project.dir, sub),
        stdio: 'pipe',
      })
    }
  }, 180_000)

  afterAll(() => project.cleanup())

  it.skipIf(!UV_AVAILABLE || !PNPM_AVAILABLE)(
    'format --check exits 0 on a well-formatted scaffold',
    () => {
      project.run('format')
      expect(project.run('format', '--check').status).toBe(0)
    },
  )

  it.skipIf(!UV_AVAILABLE)('format --check exits 1 on a badly-formatted .py file', () => {
    project.write('backend/app/utils/bad.py', '"""Bad formatting."""\nx=1\ny   =   2\n')
    expect(project.run('format', '--check').status).toBe(1)
    project.restore('backend/app/utils/bad.py')
  })

  it.skipIf(!UV_AVAILABLE)('format (write) fixes a badly-formatted .py file', () => {
    project.write('backend/app/utils/bad.py', '"""Bad."""\nx=1\n')
    expect(project.run('format').status).toBe(0)
    expect(project.run('format', '--check').status).toBe(0)
    project.restore('backend/app/utils/bad.py')
  })

  it.skipIf(!PNPM_AVAILABLE)('format --check exits 1 on a badly-formatted .ts file', () => {
    project.write('frontend/src/bad.ts', 'export const x=1\nexport const y   =   2\n')
    expect(project.run('format', '--check').status).toBe(1)
    project.restore('frontend/src/bad.ts')
  })

  it.skipIf(!PNPM_AVAILABLE)('format (write) fixes a badly-formatted .ts file', () => {
    project.write('frontend/src/bad.ts', 'export const x=1\n')
    expect(project.run('format').status).toBe(0)
    expect(project.run('format', '--check').status).toBe(0)
    project.restore('frontend/src/bad.ts')
  })
})
