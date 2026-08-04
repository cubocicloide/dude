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

describe('cli — malformed dude.json', () => {
  it('explains a broken dude.json instead of dumping a JSON SyntaxError', () => {
    // tryProjectDispatch parses dude.json before anything else, so an unguarded
    // parse takes down EVERY command in the project with a raw trace.
    const project = mkdtempSync(join(tmpdir(), 'dude-badjson-'))
    writeFileSync(join(project, 'dude.json'), '{ "stack": "x", broken\n')

    const { status, stderr } = runCLI(['lint'], { cwd: project })

    expect(status).toBe(1)
    expect(stderr).toContain('dude.json')
    expect(stderr).not.toMatch(/at JSON\.parse|at tryProjectDispatch/)
  })
})

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

  it('fails `dude init` legibly too — the path a brand-new project takes', () => {
    // The catch in tryProjectDispatch only covers commands run inside an existing
    // project (it needs a dude.json). `initCommand` resolves the stack itself, and
    // that is the ONLY path a new project takes — including the launcher's
    // `npx @cubocicloide/dude@latest init`. Because `make promote` is per-package,
    // a stack promoted to `latest` before the CLI reproduces this for real users.
    const base = mkdtempSync(join(tmpdir(), 'dude-skew-init-'))
    const stack = join(makeSkewedProject(), '..', 'stack')

    const { status, stderr } = runCLI(['init', '--stack', stack, '--yes', 'proj'], { cwd: base })

    expect(status).not.toBe(0)
    expect(stderr).not.toMatch(/at ModuleJob|at async ModuleLoader/)
    expect(stderr).toContain('dude upgrade --cli')
  })

  it('does not assert version skew for a failure that is plainly something else', () => {
    // Appending the skew narrative unconditionally told the user to run
    // `dude upgrade --cli` immediately after the loader had given the correct
    // remediation for a missing build — two confident, contradictory diagnoses.
    const base = mkdtempSync(join(tmpdir(), 'dude-nodist-'))
    const stack = join(base, 'stack')
    mkdirSync(stack, { recursive: true })
    writeFileSync(
      join(stack, 'package.json'),
      JSON.stringify({ name: '@test/nodist', version: '1.0.0', main: './dist/index.js' }),
    )
    const project = join(base, 'project')
    mkdirSync(project, { recursive: true })
    writeFileSync(join(project, 'dude.json'), JSON.stringify({ stack, answers: {} }))

    const { stderr } = runCLI(['lint'], { cwd: project })

    expect(stderr).toContain('Did you build the stack package?')
    // The skew hypothesis may be offered, but never as the established cause.
    expect(stderr).not.toContain('That call is an API this CLI')
    expect(stderr).not.toMatch(/A stack built against a newer dude CLI fails this way/)
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
