import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCLI } from './utils/testing.js'

/**
 * Version skew: a stack built against a newer CLI than the one running it.
 *
 * The stack's module body calls the helpers the CLI exports (`defineLintCommand`,
 * `defineDocsCommand`, …) while building its `commands` map, so on an older CLI it
 * fails while being imported — before `minDudeVersion` can be read, and for every
 * command rather than only the one needing the new API. `minDudeVersion` cannot
 * cover it by construction, so `cli.ts` catches the load failure instead.
 *
 * This is the flow `dude upgrade --stack` (without `--cli`) produces, which
 * CLAUDE.md documents as an example — so it has to fail legibly, and must leave
 * the remediation commands working.
 */
function makeSkewedProject(): string {
  const base = mkdtempSync(join(tmpdir(), 'dude-skew-'))
  const stack = join(base, 'stack')
  mkdirSync(join(stack, 'dist'), { recursive: true })
  writeFileSync(
    join(stack, 'package.json'),
    JSON.stringify({
      name: '@test/skew-stack',
      version: '9.0.0',
      main: './dist/index.js',
      type: 'module',
    }),
  )
  // Exactly the runtime shape of a stack calling an export this CLI lacks.
  writeFileSync(
    join(stack, 'dist', 'index.js'),
    `const dude = {}\n` +
      `export default {\n` +
      `  name: 'skew',\n` +
      `  version: '9.0.0',\n` +
      `  description: 'skew fixture',\n` +
      `  commands: { lint: dude.defineDocsCommand() },\n` +
      `}\n`,
  )

  const project = join(base, 'project')
  mkdirSync(project, { recursive: true })
  writeFileSync(
    join(project, 'dude.json'),
    JSON.stringify({ stack, stackVersion: '9.0.0', answers: {} }),
  )
  return project
}

describe('cli — stack newer than the CLI', () => {
  it('fails a stack command legibly instead of dumping a stack trace', () => {
    const { status, stderr } = runCLI(['lint'], { cwd: makeSkewedProject() })

    expect(status).toBe(1)
    expect(stderr).toContain('could not load stack')
    expect(stderr).toContain('dude upgrade --cli')
    // The raw cause is kept — hiding it would make a genuine stack bug unreportable.
    expect(stderr).toContain('defineDocsCommand is not a function')
    // But not as an unhandled rejection.
    expect(stderr).not.toMatch(/at ModuleJob|at async ModuleLoader/)
  })

  it('keeps core commands working, so the advice it gives is actionable', () => {
    // `dude upgrade --cli` is the fix; exiting non-zero here would strand the user
    // with instructions they cannot carry out.
    const project = makeSkewedProject()

    const version = runCLI(['version'], { cwd: project })
    expect(version.status).toBe(0)
    expect(version.stdout).toMatch(/^dude \d+\.\d+\.\d+/)
    expect(version.stderr).toContain('could not be loaded')

    expect(runCLI(['upgrade', '--help'], { cwd: project }).status).toBe(0)
  })
})
