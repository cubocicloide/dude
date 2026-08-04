import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Tests for the page-refresh half of `defineDocsCommand()`.
 *
 * The per-stack docs tests that survived the consolidation never create
 * `docs/docs/api.md`, so the `existsSync` gate short-circuits and none of this
 * logic runs under them. That gap is what this file closes: the multi-page loop,
 * the per-page isolation, and the "only refresh what the scaffold ships" rule.
 */

vi.mock('node:child_process', () => ({
  // Docker "running", and a spawned child that closes immediately.
  spawnSync: vi.fn(() => ({ error: null, status: 0 })),
  spawn: vi.fn(() => ({
    pid: 1234,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: (event: string, cb: () => void) => {
      if (event === 'close') cb()
    },
  })),
}))

function makeProject(pages: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'dude-docs-cmd-'))
  mkdirSync(join(root, 'docs', 'docs'), { recursive: true })
  writeFileSync(
    join(root, 'dude.json'),
    JSON.stringify({ stack: '@cubocicloide/stack-absent', answers: { projectName: 'demo' } }),
  )
  for (const p of pages) writeFileSync(join(root, 'docs', 'docs', p), 'PLACEHOLDER\n')
  return root
}

let stderr: string[] = []
let stdout: string[] = []

beforeEach(() => {
  stderr = []
  stdout = []
  vi.spyOn(process.stderr, 'write').mockImplementation((c) => (stderr.push(String(c)), true))
  vi.spyOn(process.stdout, 'write').mockImplementation((c) => (stdout.push(String(c)), true))
})
afterEach(() => vi.restoreAllMocks())

describe('defineDocsCommand — generated page refresh', () => {
  it('rewrites every generated page the scaffold ships', async () => {
    const { defineDocsCommand } = await import('./command.js')
    const root = makeProject(['api.md', 'cheatsheet.md'])

    await defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: {} })

    const api = readFileSync(join(root, 'docs', 'docs', 'api.md'), 'utf8')
    const sheet = readFileSync(join(root, 'docs', 'docs', 'cheatsheet.md'), 'utf8')
    expect(api).not.toContain('PLACEHOLDER')
    expect(api).toContain('# Command reference')
    expect(sheet).not.toContain('PLACEHOLDER')
    expect(sheet).toContain('cheatsheet')
    expect(stdout.join('')).toContain('Regenerated docs/api.md')
    expect(stdout.join('')).toContain('Regenerated docs/cheatsheet.md')
  })

  it('leaves a page the scaffold does not ship alone', async () => {
    const { defineDocsCommand } = await import('./command.js')
    // Only api.md exists — a stack may not include the cheatsheet page. Writing an
    // unexpected file would break that stack's mkdocs nav with a strict build.
    const root = makeProject(['api.md'])

    await defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: {} })

    expect(readFileSync(join(root, 'docs', 'docs', 'api.md'), 'utf8')).not.toContain('PLACEHOLDER')
    expect(stdout.join('')).not.toContain('cheatsheet.md')
    expect(() => readFileSync(join(root, 'docs', 'docs', 'cheatsheet.md'), 'utf8')).toThrow()
  })

  it('exits 1 with an explanation when there is no docs/ folder', async () => {
    const { defineDocsCommand } = await import('./command.js')
    const root = mkdtempSync(join(tmpdir(), 'dude-docs-nodocs-'))
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('EXIT')
    })

    await expect(
      defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: {} }),
    ).rejects.toThrow('EXIT')
    expect(stderr.join('')).toContain('No docs/ folder')
    exit.mockRestore()
  })

  it('honours a custom --port in the served URL', async () => {
    const { defineDocsCommand } = await import('./command.js')
    const root = makeProject(['api.md'])

    await defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: { port: '9099' } })

    expect(stdout.join('')).toContain('http://localhost:9099')
  })
})
