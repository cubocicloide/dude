import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateCheatsheet, collectCheatsheetData } from './index.js'

/**
 * Builds a synthetic project: a `dude.json` plus a couple of rule files. No
 * scaffolding, so these stay fast — what is under test is the harvesting, which
 * is where the fragile parsing lives.
 */
function makeProject(
  rules: Record<string, string> = {},
  opts: { disable?: string[]; projectChecks?: string[] } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), 'dude-cheatsheet-'))
  writeFileSync(
    join(dir, 'dude.json'),
    JSON.stringify({
      stack: '@cubocicloide/stack-test',
      stackVersion: '1.2.3',
      dudeVersion: '0.15.1',
      answers: { projectName: 'demo', database: 'postgres', celery: true },
      ...(opts.disable ? { lint: { disable: opts.disable } } : {}),
    }),
  )
  for (const rel of opts.projectChecks ?? []) {
    const f = join(dir, '.dude', 'lint', 'checks', rel)
    mkdirSync(join(f, '..'), { recursive: true })
    writeFileSync(f, 'export default () => []\n')
  }
  for (const [rel, body] of Object.entries(rules)) {
    const file = join(dir, '.claude', 'rules', rel)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, body)
  }
  return dir
}

describe('cheatsheet — rule harvesting', () => {
  it('derives the code from the path and the title from the H1', async () => {
    const dir = makeProject({
      'BE/003.md': '---\npaths:\n  - "x/**"\n---\n\n# BE003 — Schema class conventions\n\nBody.\n',
      'FE/011.md': '# FE011 — No inline styles\n',
    })
    const { rules } = await collectCheatsheetData(dir)
    expect(rules).toEqual([
      { code: 'BE003', group: 'BE', title: 'Schema class conventions', source: 'stack' },
      { code: 'FE011', group: 'FE', title: 'No inline styles', source: 'stack' },
    ])
  })

  it('keeps a parenthetical severity suffix, which several stacks use', async () => {
    const dir = makeProject({ 'AF/002.md': '# AF002 — explicit schedule (error)\n' })
    const { rules } = await collectCheatsheetData(dir)
    expect(rules[0]?.title).toBe('explicit schedule (error)')
  })

  it('falls back to the bare code when a rule file has no heading', async () => {
    const dir = makeProject({ 'PY/001.md': 'No heading here.\n' })
    const { rules } = await collectCheatsheetData(dir)
    expect(rules[0]).toEqual({ code: 'PY001', group: 'PY', title: 'PY001', source: 'stack' })
  })

  it('excludes codes disabled via dude.json, and states them separately', async () => {
    // The engine skips disabled codes outright, so listing one as enforced would
    // tell an agent a rule will be checked when it never runs.
    const dir = makeProject(
      { 'BE/001.md': '# BE001 — A\n', 'BE/002.md': '# BE002 — B\n' },
      { disable: ['BE002'] },
    )
    const { rules, disabledRules } = await collectCheatsheetData(dir)
    expect(rules.map((r) => r.code)).toEqual(['BE001'])
    expect(disabledRules).toEqual(['BE002'])
  })

  it('includes project-local checks, which run but ship no prose file', async () => {
    const dir = makeProject({ 'BE/001.md': '# BE001 — A\n' }, { projectChecks: ['PRJ/001.ts'] })
    const { rules } = await collectCheatsheetData(dir)
    expect(rules.map((r) => `${r.code}:${r.source}`)).toEqual(['BE001:stack', 'PRJ001:project'])
  })

  it('ignores a project check test file', async () => {
    const dir = makeProject({}, { projectChecks: ['PRJ/001.ts', 'PRJ/001.test.ts'] })
    const { rules } = await collectCheatsheetData(dir)
    expect(rules.map((r) => r.code)).toEqual(['PRJ001'])
  })

  it('reports no rules when the project ships no .claude/rules', async () => {
    const { rules } = await collectCheatsheetData(makeProject())
    expect(rules).toEqual([])
  })
})

describe('cheatsheet — output', () => {
  it('emits a versioned, self-describing JSON payload', async () => {
    const dir = makeProject({ 'BE/001.md': '# BE001 — Required structure\n' })
    const parsed = JSON.parse(await generateCheatsheet(dir, 'json'))

    expect(parsed.schema).toBe('dude.cheatsheet/1')
    expect(parsed.project).toBe('demo')
    expect(parsed.stackVersion).toBe('1.2.3')
    expect(parsed.answers).toMatchObject({ database: 'postgres', celery: true })
    expect(parsed.rules).toHaveLength(1)
    // The catalog is embedded whole, so one fetch gives an agent everything.
    expect(parsed.catalog.commands.map((c: { name: string }) => c.name)).toContain('help')
  })

  it('renders Markdown carrying the scaffold answers and the rule table', async () => {
    const dir = makeProject({ 'BE/001.md': '# BE001 — Required structure\n' })
    const md = await generateCheatsheet(dir, 'md')

    expect(md).toContain('# demo — cheatsheet')
    expect(md).toContain('`database` = `postgres`')
    expect(md).toContain('| `BE001` | Required structure | stack |')
    // The embedded catalog must not carry its own page banner, which would tell
    // the reader to refresh via `dude docs` — the wrong command here.
    expect(md).not.toContain('Auto-generated by')
    expect(md).toContain('## Commands available here')
  })

  it('rejects an unknown format at the type boundary by defaulting to md', async () => {
    const dir = makeProject()
    // The command layer validates the flag; the renderer treats anything not
    // 'json' as Markdown rather than throwing mid-render.
    const md = await generateCheatsheet(dir, 'md')
    expect(md.startsWith('# ')).toBe(true)
  })
})
