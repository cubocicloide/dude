/**
 * Integration test: `dude help`
 */
import { describe, expect, it } from 'vitest'
import { runCLI } from '../../utils/testing.js'

describe('dude help', () => {
  it('exits 0', () => {
    expect(runCLI(['help']).status).toBe(0)
  })

  it('lists all core commands', () => {
    const { stdout } = runCLI(['help'])
    for (const cmd of ['init', 'upgrade', 'version']) {
      expect(stdout).toContain(cmd)
    }
  })

  it('does not show stack commands when outside a project', () => {
    const { stdout } = runCLI(['help'])
    // Stack commands only appear inside a project with dude.json.
    // Use word-boundary regex to avoid false positives (e.g. "upgrade" contains "up").
    for (const cmd of ['lint', 'format', 'review', 'down', 'logs', 'shell']) {
      expect(stdout).not.toContain(cmd)
    }
    // "up" needs a stricter check — "upgrade" contains the substring "up"
    expect(stdout).not.toMatch(/^\s+up\s/m)
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
