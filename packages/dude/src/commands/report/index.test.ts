/**
 * Tests for `dude report`.
 *
 * Integration tests drive the CLI with `--print`, which assembles the report
 * and touches nothing (no `gh`, no browser, no network) — safe and
 * deterministic. Unit tests exercise the pure builders directly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project, runCLI } from '../../utils/testing.js'
import { buildBody, buildWebUrl } from './index.js'

// ── Integration: `dude report --print` ────────────────────────────────────────

describe('dude report --print', () => {
  it('assembles a report outside a project (core area, base labels)', () => {
    const r = runCLI(['report', '--print', '--title', 'boom', '--actual', 'it exploded'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Target repo: cubocicloide/dude')
    expect(r.stdout).toContain('Labels:      bug, triage')
    expect(r.stdout).toContain('Title:       boom')
    expect(r.stdout).toContain('### What actually happened?')
    expect(r.stdout).toContain('it exploded')
    // Diagnostics are attached automatically.
    expect(r.stdout).toContain('dude info')
    // No project → core area, no stack label.
    expect(r.stdout).toContain('CLI runtime / not sure')
    expect(r.stdout).not.toContain('stack:')
  })

  describe('inside a project', () => {
    let project: Project
    beforeAll(() => {
      project = Project.scaffold({ prefix: 'dude-report-' })
    }, 60_000)
    afterAll(() => project.cleanup())

    it('infers the stack for area, label, and section', () => {
      const r = project.run('report', '--print', '--title', 'boom', '--actual', 'x')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('stack:react-fastapi')
      expect(r.stdout).toContain('A stack (react-fastapi)')
      expect(r.stdout).toMatch(/### Stack\n\nreact-fastapi/)
    })
  })
})

// ── Unit: pure builders ───────────────────────────────────────────────────────

describe('buildWebUrl', () => {
  const diag = 'dude info\n\nCLI: 0.0.0'

  it('targets the bug report form and round-trips fields', () => {
    const url = buildWebUrl(
      { title: 'My bug', actual: 'it broke', command: 'dude up' },
      diag,
      'react-fastapi',
    )
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://github.com/cubocicloide/dude/issues/new')
    expect(u.searchParams.get('template')).toBe('bug_report.yml')
    expect(u.searchParams.get('title')).toBe('My bug')
    expect(u.searchParams.get('stack')).toBe('react-fastapi')
    expect(u.searchParams.get('actual')).toBe('it broke')
    expect(u.searchParams.get('versions')).toBe(diag)
  })

  it('omits the stack param when not in a project', () => {
    const url = buildWebUrl({ title: 't' }, diag, undefined)
    expect(new URL(url).searchParams.has('stack')).toBe(false)
  })

  it('truncates a very long command to keep the URL bounded', () => {
    const long = 'x'.repeat(5000)
    const url = buildWebUrl({ command: long }, diag, undefined)
    const got = new URL(url).searchParams.get('command') ?? ''
    expect(got.length).toBeLessThan(long.length)
    expect(got).toContain('truncated')
  })
})

describe('buildBody', () => {
  it('mirrors the issue-form sections and embeds fenced diagnostics', () => {
    const body = buildBody(
      { actual: 'crash', expected: 'no crash' },
      'dude info\n\nCLI: 0.0.0',
      'tauri',
    )
    expect(body).toContain('### Area\n\nA stack (tauri)')
    expect(body).toContain('### Stack\n\ntauri')
    expect(body).toContain('### Diagnostics\n\n```\ndude info')
    expect(body).toContain('### What actually happened?\n\ncrash')
    expect(body).toContain('### What did you expect to happen?\n\nno crash')
    // Unfilled optional fields fall back gracefully.
    expect(body).toContain('### Steps to reproduce\n\n_Not provided._')
  })
})
