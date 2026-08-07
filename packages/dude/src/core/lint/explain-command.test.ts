/**
 * Unit tests for the shared `explain` command (`defineExplainCommand`).
 *
 * These run against a real temporary project rather than a mocked engine: the
 * whole point of the command is *where it looks for prose*, and the two
 * locations (stack rules under `.claude/rules/`, project rules as a sibling of
 * the check) are only meaningfully exercised on a real tree.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'pathe'

import { defineExplainCommand } from './explain-command.js'

class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`)
  }
}

let stdout: string[]
let stderr: string[]
let exitSpy: MockInstance<typeof process.exit>
let root: string
let stackRoot: string

function write(file: string, contents: string) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, contents)
}

/** A stack check lives compiled under the stack root; its prose in the project. */
function addStackRule(group: string, id: string, prose?: string) {
  write(path.join(stackRoot, 'dist', 'commands', 'lint', 'checks', group, `${id}.js`), 'export default () => []\n')
  if (prose !== undefined) {
    write(path.join(root, '.claude', 'rules', group, `${id}.md`), prose)
  }
}

/** A project check and its prose are siblings under `.dude/lint/checks/`. */
function addProjectRule(group: string, id: string, prose?: string) {
  write(path.join(root, '.dude', 'lint', 'checks', group, `${id}.ts`), 'export default () => []\n')
  if (prose !== undefined) {
    write(path.join(root, '.dude', 'lint', 'checks', group, `${id}.md`), prose)
  }
}

function ctx(args: Record<string, unknown> = {}) {
  return { projectRoot: root, stackRoot, args }
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dude-explain-'))
  stackRoot = mkdtempSync(path.join(tmpdir(), 'dude-explain-stack-'))
  stdout = []
  stderr = []
  vi.spyOn(process.stdout, 'write').mockImplementation((s) => (stdout.push(String(s)), true))
  vi.spyOn(process.stderr, 'write').mockImplementation((s) => (stderr.push(String(s)), true))
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new ProcessExitError(code ?? 0)
  }) as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
  rmSync(stackRoot, { recursive: true, force: true })
})

describe('defineExplainCommand — definition', () => {
  it('declares its code argument as a positional', () => {
    // Anything else and `dude explain BE003` never reaches `run`.
    expect(defineExplainCommand().args?.code?.type).toBe('positional')
  })

  it('accepts a custom description', () => {
    expect(defineExplainCommand({ description: 'Custom.' }).description).toBe('Custom.')
  })
})

describe('explain — stack rules', () => {
  it('prints the prose from .claude/rules/<GROUP>/<NNN>.md', async () => {
    addStackRule('BE', '003', '# BE003 — Schema class conventions\n\nUse a services layer.\n')

    await defineExplainCommand().run(ctx({ code: 'BE003' }))

    expect(stdout.join('')).toContain('# BE003 — Schema class conventions')
    expect(stdout.join('')).toContain('Use a services layer.')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('accepts a lower-case code', async () => {
    addStackRule('BE', '003', '# BE003 — Title\n\nBody.\n')

    await defineExplainCommand().run(ctx({ code: 'be003' }))

    expect(stdout.join('')).toContain('# BE003 — Title')
  })
})

describe('explain — project rules', () => {
  it('resolves prose from the sibling file the scaffolded contract advertises', async () => {
    addProjectRule('PRJ', '001', '# PRJ001 — House rule\n\nDo the thing.\n')

    await defineExplainCommand().run(ctx({ code: 'PRJ001' }))

    expect(stdout.join('')).toContain('# PRJ001 — House rule')
    expect(stdout.join('')).toContain('Do the thing.')
  })
})

describe('explain — unknown code', () => {
  it('exits non-zero and lists the known codes', async () => {
    addStackRule('BE', '003', '# BE003 — Title\n')
    addProjectRule('PRJ', '001', '# PRJ001 — House rule\n')

    await expect(defineExplainCommand().run(ctx({ code: 'ZZ999' }))).rejects.toThrow(ProcessExitError)

    expect(stderr.join('')).toContain('unknown lint code "ZZ999"')
    expect(stderr.join('')).toContain('BE003')
    expect(stderr.join('')).toContain('PRJ001')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})

describe('explain — missing prose', () => {
  it('names the expected path rather than reporting the rule as undocumented', async () => {
    addProjectRule('PRJ', '002') // check exists, prose does not

    await expect(defineExplainCommand().run(ctx({ code: 'PRJ002' }))).rejects.toThrow(ProcessExitError)

    expect(stderr.join('')).toContain('PRJ002 has no prose file')
    expect(stderr.join('')).toContain(path.join('.dude', 'lint', 'checks', 'PRJ', '002.md'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('calls a stack rule without prose a packaging bug', async () => {
    addStackRule('BE', '009') // shipped check with no matching rules file

    await expect(defineExplainCommand().run(ctx({ code: 'BE009' }))).rejects.toThrow(ProcessExitError)

    expect(stderr.join('')).toContain(path.join('.claude', 'rules', 'BE', '009.md'))
    expect(stderr.join('')).toContain('stack packaging bug')
  })
})

describe('explain — disabled rules', () => {
  it('still explains a disabled rule, but says it will not run', async () => {
    addStackRule('BE', '003', '# BE003 — Title\n\nBody.\n')
    writeFileSync(path.join(root, 'dude.json'), JSON.stringify({ lint: { disable: ['BE003'] } }))

    await defineExplainCommand().run(ctx({ code: 'BE003' }))

    expect(stdout.join('')).toContain('# BE003 — Title')
    expect(stderr.join('')).toContain('BE003 is disabled')
  })
})

describe('explain — no code given', () => {
  it('lists the known codes with their titles instead of erroring', async () => {
    addStackRule('BE', '003', '# BE003 — Schema class conventions\n')
    addProjectRule('PRJ', '001', '# PRJ001 — House rule\n')

    await defineExplainCommand().run(ctx())

    const out = stdout.join('')
    expect(out).toContain('Usage: dude explain <CODE>')
    expect(out).toContain('BE003 — Schema class conventions')
    expect(out).toContain('PRJ001 (project) — House rule')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('falls back to the bare code when a rule has no prose', async () => {
    addStackRule('BE', '004')

    await defineExplainCommand().run(ctx())

    expect(stdout.join('')).toContain('BE004 — BE004')
  })
})
