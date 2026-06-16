/**
 * Integration test: project-local custom commands end-to-end.
 *
 * Scaffolds a real project, makes `@cubocicloide/dude` resolvable from it (as
 * `pnpm install` would), and drives the installed dispatch + help paths.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { Project, REPO_ROOT } from '../utils/testing.js'

let project: Project

describe('custom commands (end-to-end)', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-custom-' })
    // jiti resolves a command file's imports against the project's node_modules,
    // so the shipped hello.ts can `import { defineCommand } from '@cubocicloide/dude'`.
    const scope = join(project.dir, 'node_modules', '@cubocicloide')
    mkdirSync(scope, { recursive: true })
    symlinkSync(join(REPO_ROOT, 'packages', 'dude'), join(scope, 'dude'))
  }, 60_000)

  afterAll(() => project.cleanup())

  it('ships an example hello command that runs', () => {
    const r = project.run('hello')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Hello, world')
  })

  it('passes flags through to the custom command', () => {
    const r = project.run('hello', '--name', 'Stan', '--shout')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('HELLO, STAN')
  })

  it('lists custom commands under PROJECT COMMANDS in help', () => {
    const r = project.run('help')
    expect(r.stdout).toContain('PROJECT COMMANDS')
    expect(r.stdout).toMatch(/hello\s+Example custom command/)
  })

  it('shows a custom command’s flags in `help <cmd>`', () => {
    const r = project.run('help', 'hello')
    expect(r.stdout).toContain('--name')
    expect(r.stdout).toContain('--shout')
  })

  it('lets a custom command override a stack command', () => {
    project.write(
      '.dude/commands/lint.ts',
      `export default { description: 'Custom lint.', async run() { process.stdout.write('CUSTOM LINT\\n') } }`,
    )
    const run = project.run('lint')
    const help = project.run('help')
    project.restore('.dude/commands/lint.ts')

    expect(run.stdout).toContain('CUSTOM LINT')
    expect(help.stdout).toMatch(/lint\s+Custom lint\.\s+\(overrides default\)/)
  })

  it('hard-fails when an explicitly invoked command is broken', () => {
    project.write('.dude/commands/oops.ts', `export default { description: 'no run' }`)
    const r = project.run('oops')
    project.restore('.dude/commands/oops.ts')

    expect(r.status).toBe(1)
    expect(r.stderr).toContain('could not be loaded')
  })

  it('ignores a reserved-name file and still runs the core command', () => {
    project.write('.dude/commands/version.ts', `export default { description: 'x', async run() {} }`)
    const r = project.run('version')
    project.restore('.dude/commands/version.ts')

    expect(r.status).toBe(0)
    // core version prints the CLI version, not our stub (which writes nothing)
    expect(r.stdout).toMatch(/\d+\.\d+\.\d+/)
  })
})
