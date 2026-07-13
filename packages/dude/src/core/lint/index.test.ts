/**
 * Unit tests for the shared lint engine.
 *
 * Stack-check fixtures are written as CommonJS `.js` files (`module.exports =`)
 * so dynamic `import()` exposes them as `default` without needing a built
 * package. Project-check fixtures are real TypeScript, loaded through jiti
 * exactly as in production.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLint, PROJECT_CHECKS_DIR } from './index.js'

let root: string
let stackRoot: string

const STACK_CHECKS = 'dist/commands/lint/checks'

/** A CJS stack check returning the given diagnostics (JSON-encoded). */
function stackCheck(group: string, id: string, diagnostics: unknown[] = []): void {
  const dir = join(stackRoot, STACK_CHECKS, group)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${id}.js`),
    `module.exports = function check() { return ${JSON.stringify(diagnostics)} }`,
    'utf8',
  )
}

/** A TypeScript project check under .dude/lint/checks/. */
function projectCheck(group: string, file: string, source: string): void {
  const dir = join(root, PROJECT_CHECKS_DIR, group)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), source, 'utf8')
}

function diag(file: string, severity: 'error' | 'warning', message = 'msg') {
  return { file, line: 1, col: 1, severity, message }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dude-lint-root-'))
  stackRoot = mkdtempSync(join(tmpdir(), 'dude-lint-stack-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(stackRoot, { recursive: true, force: true })
})

describe('runLint — stack checks', () => {
  it('throws when the stack checks directory is missing', async () => {
    await expect(runLint(root, stackRoot)).rejects.toThrow(/No lint checks directory/)
  })

  it('derives codes from the path and aggregates counts', async () => {
    stackCheck('BE', '001', [diag('a.py', 'error')])
    stackCheck('FE', '002', [diag('b.tsx', 'warning')])

    const result = await runLint(root, stackRoot)
    expect(result.diagnostics.map((d) => d.code).sort()).toEqual(['BE001', 'FE002'])
    expect(result.errorCount).toBe(1)
    expect(result.warningCount).toBe(1)
    expect(result.notices).toEqual([])
  })

  it('rejects a check whose default export is not a function', async () => {
    const dir = join(stackRoot, STACK_CHECKS, 'BE')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '001.js'), 'module.exports = { nope: true }', 'utf8')

    await expect(runLint(root, stackRoot)).rejects.toThrow(/must export a default function/)
  })
})

describe('runLint — project checks (.dude/lint/checks)', () => {
  beforeEach(() => {
    stackCheck('BE', '001')
  })

  it('discovers TypeScript project checks and merges their diagnostics', async () => {
    projectCheck(
      'PRJ',
      '001.ts',
      `export default function check(root: string) {
         return [{ file: 'x.py', line: 3, col: 2, severity: 'error' as const, message: 'custom rule' }]
       }`,
    )

    const result = await runLint(root, stackRoot)
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({ code: 'PRJ001', message: 'custom rule' })
    expect(result.errorCount).toBe(1)
  })

  it('ignores docs, declaration files, and co-located tests', async () => {
    projectCheck('PRJ', '001.ts', 'export default () => []')
    projectCheck('PRJ', '001.md', '# PRJ001 — prose description')
    projectCheck('PRJ', '001.test.ts', 'throw new Error("tests must not be loaded")')
    projectCheck('PRJ', '002.d.ts', 'declare const x: number')

    await expect(runLint(root, stackRoot)).resolves.toBeTruthy()
  })

  it('errors hard when a project check claims a stack code', async () => {
    projectCheck('BE', '001.ts', 'export default () => []')

    await expect(runLint(root, stackRoot)).rejects.toThrow(
      /BE001 is defined twice[\s\S]*lint\.disable/,
    )
  })

  it('errors hard when two project files claim the same code', async () => {
    projectCheck('PRJ', '001.ts', 'export default () => []')
    projectCheck('PRJ', '001.mjs', 'export default () => []')

    await expect(runLint(root, stackRoot)).rejects.toThrow(/PRJ001 is defined twice/)
  })

  it('project checks can be async', async () => {
    projectCheck(
      'PRJ',
      '001.ts',
      `export default async function check() {
         return [{ file: 'y.ts', line: 1, col: 1, severity: 'warning' as const, message: 'async ok' }]
       }`,
    )

    const result = await runLint(root, stackRoot)
    expect(result.warningCount).toBe(1)
  })
})

describe('runLint — lint.disable in dude.json', () => {
  it('skips disabled checks entirely and never executes them', async () => {
    stackCheck('BE', '001', [diag('a.py', 'error')])
    // Executing this check would throw — proving disable skips execution.
    const dir = join(stackRoot, STACK_CHECKS, 'BE')
    writeFileSync(join(dir, '002.js'), 'module.exports = () => { throw new Error("ran") }', 'utf8')
    writeFileSync(join(root, 'dude.json'), JSON.stringify({ lint: { disable: ['BE002'] } }), 'utf8')

    const result = await runLint(root, stackRoot)
    expect(result.errorCount).toBe(1)
    expect(result.notices).toEqual([])
  })

  it('notices a disabled code that matches no check', async () => {
    stackCheck('BE', '001')
    writeFileSync(join(root, 'dude.json'), JSON.stringify({ lint: { disable: ['ZZ999'] } }), 'utf8')

    const result = await runLint(root, stackRoot)
    expect(result.notices).toHaveLength(1)
    expect(result.notices[0]).toContain('ZZ999')
  })

  it('disable applies to project checks too', async () => {
    stackCheck('BE', '001')
    projectCheck('PRJ', '001.ts', 'export default () => { throw new Error("ran") }')
    writeFileSync(join(root, 'dude.json'), JSON.stringify({ lint: { disable: ['PRJ001'] } }), 'utf8')

    await expect(runLint(root, stackRoot)).resolves.toBeTruthy()
  })

  it('tolerates dude.json without a lint block', async () => {
    stackCheck('BE', '001')
    writeFileSync(join(root, 'dude.json'), JSON.stringify({ stack: 'x' }), 'utf8')

    const result = await runLint(root, stackRoot)
    expect(result.notices).toEqual([])
  })
})
