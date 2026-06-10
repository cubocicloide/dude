/**
 * Integration test: global CLI installation.
 *
 * Steps tested:
 * - `pnpm link --global` installs the `dude` binary with no errors
 * - `dude` is resolvable on PATH after installation
 * - `dude help` exits 0 and lists the expected core commands
 * - cleanup: `pnpm unlink --global` removes the binary
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_DIR = resolve(__dirname, '..') // packages/dude/

function run(cmd: string, args: string[], cwd?: string, env?: Record<string, string>) {
  return spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, ...env },
  })
}

let installResult: ReturnType<typeof run>

describe('dude global installation', () => {
  beforeAll(() => {
    // NODE_NO_WARNINGS suppresses Node deprecation notices that would pollute stderr
    installResult = run('pnpm', ['link', '--global'], PACKAGE_DIR, { NODE_NO_WARNINGS: '1' })
    process.stdout.write(`   [install] pnpm link --global exit=${installResult.status}\n`)
    process.stdout.write(`   [install] stdout: ${installResult.stdout.trim()}\n`)
    process.stdout.write(`   [install] stderr: ${installResult.stderr.trim()}\n`)

    // pnpm link --global places the bin shim inside the global node_modules, NOT in PNPM_HOME
    // directly. `pnpm root -g` returns that node_modules path; the shims are in root/.bin.
    // `pnpm bin -g` returns empty in corepack CI, so we use `pnpm root -g` instead.
    const sep = process.platform === 'win32' ? ';' : ':'
    const slash = sep === ':' ? '/' : '\\'
    const globalRoot = run('pnpm', ['root', '-g'])
    const rootDir = globalRoot.status === 0 ? globalRoot.stdout.trim() : ''
    process.stdout.write(`   [install] pnpm root -g => ${JSON.stringify(rootDir)}\n`)

    if (rootDir) {
      const binDir = `${rootDir}${slash}.bin`
      process.env.PATH = `${binDir}${sep}${process.env.PATH ?? ''}`
      const ls = run('ls', [binDir])
      process.stdout.write(`   [install] ${binDir} contents: ${ls.stdout.trim() || '(empty or missing)'}\n`)
    }
    process.stdout.write(`   [install] PATH now starts with: ${(process.env.PATH ?? '').split(sep).slice(0, 3).join(sep)}\n`)
  }, 30000)

  afterAll(() => {
    run('pnpm', ['unlink', '--global', '@cubocicloide/dude'])
  })

  it('pnpm link --global exits 0 with no errors', () => {
    expect(installResult.status).toBe(0)
    expect(installResult.error).toBeUndefined()
    // stderr should not contain error-level output
    expect(installResult.stderr.toLowerCase()).not.toContain('err')
  })

  it('dude is resolvable on PATH', () => {
    const which = process.platform === 'win32'
      ? run('where', ['dude'])
      : run('which', ['dude'])
    expect(which.status).toBe(0)
    expect(which.stdout.trim()).not.toBe('')
  })

  it('dude help exits 0', () => {
    const result = run('dude', ['help'])
    expect(result.status).toBe(0)
  })

  it('dude help lists the core commands', () => {
    const result = run('dude', ['help'])
    const output = result.stdout + result.stderr
    expect(output).toContain('init')
    expect(output).toContain('up')
    expect(output).toContain('down')
    expect(output).toContain('logs')
    expect(output).toContain('shell')
  })

  it('dude help shows no stack-specific commands outside a project', () => {
    const result = run('dude', ['help'])
    const output = result.stdout + result.stderr
    // Stack commands like lint/format only appear inside a project with dude.json
    expect(output).not.toContain('lint')
    expect(output).not.toContain('format')
    expect(output).not.toContain('review')
  })
})
