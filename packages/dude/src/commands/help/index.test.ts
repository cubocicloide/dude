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
})
