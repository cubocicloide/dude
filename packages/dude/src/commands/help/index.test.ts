/**
 * Integration test: `dude help`
 */
import { describe, expect, it } from 'vitest'
import { runCLI } from '../../utils/testing.js'
import { coreCommands } from './index.js'

describe('dude help', () => {
  it('exits 0', () => {
    expect(runCLI(['help']).status).toBe(0)
  })

  it('lists every core command, derived from the registry rather than a literal', () => {
    // Derived from `coreCommands` on purpose. A hardcoded array would still pass
    // if someone registered a 7th core command and forgot the catalog — which is
    // exactly the bug this test exists to prevent, since a command missing from
    // the catalog is invisible to any agent reading `--format json`.
    const { stdout } = runCLI(['help', '--format', 'json'])
    const names = (JSON.parse(stdout).commands as { name: string }[]).map((c) => c.name)
    expect(names.sort()).toEqual(Object.keys(coreCommands).sort())
  })

  it('actually dispatches every registered core command', () => {
    // Not `Object.keys(coreCommands)` against `coreCommandNames` — those are the
    // same object, so that assertion could never fail while claiming to pin
    // dispatch. This drives the real binary once per command and requires citty to
    // route it, which is the property that matters.
    for (const name of Object.keys(coreCommands)) {
      const { status, stderr } = runCLI([name, '--help'])
      expect(status, `dude ${name} --help should be dispatched`).toBe(0)
      expect(stderr).not.toContain('Unknown command')
    }
  })

  it('advertises its own --format flag, so the catalog is self-describing', () => {
    // Without this an agent reading `--format json` output has no structured way
    // to discover that `--format` exists in the first place.
    const { stdout } = runCLI(['help', '--format', 'json'])
    const help = (JSON.parse(stdout).commands as { name: string; args: { name: string }[] }[]).find(
      (c) => c.name === 'help',
    )
    expect(help?.args.map((a) => a.name)).toContain('format')
  })

  it('does not show stack commands when outside a project', () => {
    // Compare command NAMES, not substrings of the whole page: descriptions
    // legitimately mention words like "format", which made the old substring
    // assertion a false positive.
    const { stdout } = runCLI(['help', '--format', 'json'])
    const parsed = JSON.parse(stdout) as {
      commands: { name: string }[]
      groups: { name: string }[]
    }
    const names = [...parsed.commands.map((c) => c.name), ...parsed.groups.map((g) => g.name)]
    for (const cmd of ['up', 'down', 'logs', 'shell', 'lint', 'format', 'review', 'iac', 'db']) {
      expect(names).not.toContain(cmd)
    }
  })

  it('emits Markdown with --format md', () => {
    const { status, stdout } = runCLI(['help', '--format', 'md'])
    expect(status).toBe(0)
    expect(stdout).toContain('# Command reference')
    expect(stdout).toContain('### `dude init`')
  })

  it('emits valid JSON with --format json', () => {
    const { status, stdout } = runCLI(['help', '--format', 'json'])
    expect(status).toBe(0)
    const parsed = JSON.parse(stdout) as {
      commands: { name: string }[]
      groups: unknown[]
      projectCommands: unknown[]
    }
    expect(parsed.commands.map((c) => c.name)).toContain('init')
    expect(Array.isArray(parsed.groups)).toBe(true)
    expect(Array.isArray(parsed.projectCommands)).toBe(true)
  })
})
