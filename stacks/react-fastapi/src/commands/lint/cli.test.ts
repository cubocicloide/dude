/**
 * CLI integration test: `dude lint` (react-fastapi stack)
 *
 * Tests CLI-level behaviour: exit codes, flag handling, output shape.
 * Does NOT enumerate specific rule codes — those live in
 * src/commands/lint/checks/**\/*.test.ts (unit tests).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from '@cubocicloide/dude/testing'

let project: Project

describe('dude lint', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-lint-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('exits 0 on a clean scaffold', () => {
    const r = project.run('lint')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('No issues found.')
  })

  it('exits 1 when there is a lint error', () => {
    project.remove('backend/app/fixtures')
    const r = project.run('lint')
    expect(r.status).toBe(1)
    expect(r.stdout + r.stderr).toMatch(/error/)
    project.restore('backend/app/fixtures')
  })

  it('exits 0 after the error is fixed', () => {
    expect(project.run('lint').status).toBe(0)
  })

  it('exits 0 (not 1) when there are only warnings', () => {
    project.write(
      'backend/app/core/config.py',
      [
        '"""Settings."""',
        'from pydantic_settings import BaseSettings, SettingsConfigDict',
        'class Settings(BaseSettings):',
        '    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)',
        '    ZEBRA: str = "z"',
        '    APPLE: str = "a"',
        'settings = Settings()',
      ].join('\n'),
    )
    const r = project.run('lint')
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).toMatch(/warning/)
    project.restore('backend/app/core/config.py')
  })

  it('--quiet suppresses warnings and still exits 0', () => {
    project.write(
      'backend/app/core/config.py',
      [
        '"""Settings."""',
        'from pydantic_settings import BaseSettings, SettingsConfigDict',
        'class Settings(BaseSettings):',
        '    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)',
        '    ZEBRA: str = "z"',
        '    APPLE: str = "a"',
        'settings = Settings()',
      ].join('\n'),
    )
    const r = project.run('lint', '--quiet')
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).not.toMatch(/[A-Z]{2}\d{3}/)
    project.restore('backend/app/core/config.py')
  })
})
