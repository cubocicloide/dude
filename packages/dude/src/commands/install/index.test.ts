/**
 * Integration test: global CLI installation via pnpm link --global.
 *
 * Verifies that:
 *   - `pnpm link --global` exits 0
 *   - the `dude` binary is resolvable on PATH afterwards
 *   - `dude help` works and lists core commands
 *   - stack-specific commands are absent outside a project
 *
 * Cleanup: `pnpm unlink --global` removes the shim.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { REPO_ROOT } from '../../utils/testing.js'

const PACKAGE_DIR = resolve(REPO_ROOT, 'packages/dude')
const sep = process.platform === 'win32' ? ';' : ':'

function run(cmd: string, args: string[], env?: Record<string, string>) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, ...env },
  })
}

let installResult: ReturnType<typeof run>

describe('dude global installation', () => {
  beforeAll(() => {
    installResult = run('pnpm', ['link', '--global'], {
      NODE_NO_WARNINGS: '1',
      cwd: PACKAGE_DIR,
    } as any)

    // Expose the global .bin dir on PATH so the newly linked binary is resolvable.
    const globalRoot = run('pnpm', ['root', '-g'])
    if (globalRoot.status === 0) {
      const slash = sep === ':' ? '/' : '\\'
      const binDir = `${globalRoot.stdout.trim()}${slash}.bin`
      process.env['PATH'] = `${binDir}${sep}${process.env['PATH'] ?? ''}`
    }
  }, 30_000)

  afterAll(() => {
    run('pnpm', ['unlink', '--global', '@cubocicloide/dude'])
  })

  it('pnpm link --global exits 0', () => {
    expect(installResult.status).toBe(0)
    expect(installResult.error).toBeUndefined()
  })

  it('dude is resolvable on PATH after installation', () => {
    const which = process.platform === 'win32' ? run('where', ['dude']) : run('which', ['dude'])
    expect(which.status).toBe(0)
    expect(which.stdout.trim()).not.toBe('')
  })

  it('dude help exits 0', () => {
    expect(run('dude', ['help']).status).toBe(0)
  })

  it('dude help lists core commands', () => {
    const { stdout } = run('dude', ['help'])
    for (const cmd of ['init', 'upgrade']) {
      expect(stdout).toContain(cmd)
    }
  })

  it('dude help shows no stack commands outside a project', () => {
    // Compare command NAMES from the catalog, not substrings of the rendered
    // page: descriptions legitimately mention words like "format".
    const { stdout } = run('dude', ['help', '--format', 'json'])
    const parsed = JSON.parse(stdout) as {
      commands: { name: string }[]
      groups: { name: string }[]
    }
    const names = [...parsed.commands.map((c) => c.name), ...parsed.groups.map((g) => g.name)]
    for (const cmd of ['up', 'down', 'logs', 'shell', 'lint', 'format', 'review', 'iac', 'db']) {
      expect(names).not.toContain(cmd)
    }
  })
})
