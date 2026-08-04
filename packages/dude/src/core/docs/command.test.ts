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

// Controllable per test: `docker info` health and the spawned child's shape are
// what the docs command branches on.
interface FakeChild {
  pid: number | undefined
  stdout: { on: (e: string, cb: (c: Buffer) => void) => void }
  stderr: { on: (e: string, cb: (c: Buffer) => void) => void }
  on: (event: string, cb: () => void) => void
}

const dockerInfo = vi.fn(
  (_cmd: string, _args: string[], _opts?: unknown) => ({
    error: null as Error | null,
    status: 0 as number | null,
  }),
)
const spawnMock = vi.fn(
  (_cmd: string, _args: string[], _opts?: unknown): FakeChild => ({
    pid: 1234,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: (event, cb) => {
      if (event === 'close') cb()
    },
  }),
)

vi.mock('node:child_process', () => ({
  spawnSync: dockerInfo,
  spawn: spawnMock,
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
  dockerInfo.mockReturnValue({ error: null, status: 0 })
  spawnMock.mockReturnValue({
    pid: 1234,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: (event: string, cb: () => void) => {
      if (event === 'close') cb()
    },
  })
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

describe('defineDocsCommand — preconditions and container', () => {
  // These moved here from stacks/{react-fastapi,react-django}, which each carried a
  // byte-identical copy testing behaviour that is not stack-specific at all.
  const exitGuard = () =>
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('EXIT')
    })

  it('exits 1 when Docker reports unhealthy', async () => {
    const { defineDocsCommand } = await import('./command.js')
    dockerInfo.mockReturnValue({ error: null, status: 1 })
    const root = makeProject(['api.md'])
    const exit = exitGuard()

    await expect(
      defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: {} }),
    ).rejects.toThrow('EXIT')
    expect(stderr.join('')).toContain('Docker is not running')
    exit.mockRestore()
  })

  it('exits 1 when the docker info call itself errors', async () => {
    const { defineDocsCommand } = await import('./command.js')
    dockerInfo.mockReturnValue({ error: new Error('ENOENT'), status: null })
    const root = makeProject(['api.md'])
    const exit = exitGuard()

    await expect(
      defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: {} }),
    ).rejects.toThrow('EXIT')
    expect(stderr.join('')).toContain('Docker is not running')
    exit.mockRestore()
  })

  it('runs docker with the expected mount and port mapping', async () => {
    const { defineDocsCommand } = await import('./command.js')
    const root = makeProject(['api.md'])

    await defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: { port: '8123' } })

    const args = spawnMock.mock.calls[0]?.[1] ?? []
    expect(args).toContain('8123:8000')
    expect(args.join(' ')).toContain('squidfunk/mkdocs-material')
    expect(args.join(' ')).toContain(`${root}/docs:/docs`)
  })

  it('exits 1 when the container fails to start (no pid)', async () => {
    const { defineDocsCommand } = await import('./command.js')
    spawnMock.mockReturnValue({
      pid: undefined,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: () => undefined,
    })
    const root = makeProject(['api.md'])
    const exit = exitGuard()

    await expect(
      defineDocsCommand().run!({ projectRoot: root, stackRoot: root, args: {} }),
    ).rejects.toThrow('EXIT')
    expect(stderr.join('')).toContain('Failed to start Docker container')
    exit.mockRestore()
  })
})
