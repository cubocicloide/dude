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
    for (const cmd of ['init', 'up', 'down', 'logs', 'shell', 'upgrade']) {
      expect(stdout).toContain(cmd)
    }
  })

  it('does not show stack commands when outside a project', () => {
    const { stdout } = runCLI(['help'])
    // Stack commands (lint, format, review…) only appear inside a project with dude.json
    for (const cmd of ['lint', 'format', 'review']) {
      expect(stdout).not.toContain(cmd)
    }
  })
})
