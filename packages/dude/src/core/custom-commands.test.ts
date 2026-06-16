/**
 * Unit tests for the project-local custom-command loader.
 *
 * Fixtures use plain default-export objects (no `@cubocicloide/dude` import) so
 * they load without the package being resolvable from the tmp project.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadCustomCommands,
  resolveCustomCommand,
  CUSTOM_COMMANDS_DIR,
} from './custom-commands.js'

let projectRoot: string

function writeCommand(file: string, source: string): void {
  const dir = join(projectRoot, CUSTOM_COMMANDS_DIR)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), source, 'utf8')
}

const VALID = (desc = 'A valid command.') =>
  `export default { description: ${JSON.stringify(desc)}, async run() {} }`

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'dude-cc-'))
})
afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true })
})

describe('loadCustomCommands', () => {
  it('returns empty when .dude/commands is absent', async () => {
    const res = await loadCustomCommands(projectRoot)
    expect(res.commands.size).toBe(0)
    expect(res.errors).toEqual([])
  })

  it('loads a .ts command and names it after the file', async () => {
    writeCommand('reset.ts', VALID('Reset the database.'))
    const res = await loadCustomCommands(projectRoot)
    expect(res.errors).toEqual([])
    expect([...res.commands.keys()]).toEqual(['reset'])
    expect(res.commands.get('reset')!.description).toBe('Reset the database.')
    expect(typeof res.commands.get('reset')!.run).toBe('function')
  })

  it('loads a .mjs command too', async () => {
    writeCommand('seed.mjs', VALID('Seed data.'))
    const res = await loadCustomCommands(projectRoot)
    expect([...res.commands.keys()]).toEqual(['seed'])
  })

  it('rejects a reserved core name and keeps it out of commands', async () => {
    writeCommand('init.ts', VALID())
    const res = await loadCustomCommands(projectRoot)
    expect(res.commands.has('init')).toBe(false)
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0]).toMatchObject({ name: 'init', kind: 'reserved' })
  })

  it('keeps the first of a duplicate name and reports the second', async () => {
    writeCommand('dup.mjs', VALID('First wins.'))
    writeCommand('dup.ts', VALID('Second loses.'))
    const res = await loadCustomCommands(projectRoot)
    expect(res.commands.get('dup')!.description).toBe('First wins.')
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0]).toMatchObject({ name: 'dup', kind: 'duplicate' })
  })

  it('rejects an export missing a run function', async () => {
    writeCommand('broken.ts', `export default { description: 'no run' }`)
    const res = await loadCustomCommands(projectRoot)
    expect(res.commands.size).toBe(0)
    expect(res.errors[0]).toMatchObject({ name: 'broken', kind: 'invalid' })
    expect(res.errors[0]!.message).toContain('run')
  })

  it('rejects an export missing a description', async () => {
    writeCommand('nodesc.ts', `export default { async run() {} }`)
    const res = await loadCustomCommands(projectRoot)
    expect(res.errors[0]).toMatchObject({ name: 'nodesc', kind: 'invalid' })
  })

  it('rejects an arg with an unsupported type', async () => {
    writeCommand(
      'badarg.ts',
      `export default { description: 'x', args: { n: { type: 'number' } }, async run() {} }`,
    )
    const res = await loadCustomCommands(projectRoot)
    expect(res.errors[0]).toMatchObject({ name: 'badarg', kind: 'invalid' })
  })

  it('loads multiple valid commands sorted by name', async () => {
    writeCommand('zeta.ts', VALID())
    writeCommand('alpha.ts', VALID())
    const res = await loadCustomCommands(projectRoot)
    expect([...res.commands.keys()]).toEqual(['alpha', 'zeta'])
  })
})

describe('resolveCustomCommand (lazy single load)', () => {
  it('returns null when no file claims the name', async () => {
    writeCommand('reset.ts', VALID())
    expect(await resolveCustomCommand(projectRoot, 'nope')).toBeNull()
  })

  it('returns null when the commands dir is absent', async () => {
    expect(await resolveCustomCommand(projectRoot, 'reset')).toBeNull()
  })

  it('resolves only the matching command', async () => {
    writeCommand('reset.ts', VALID('Reset.'))
    const res = await resolveCustomCommand(projectRoot, 'reset')
    expect(res?.def?.description).toBe('Reset.')
    expect(res?.error).toBeUndefined()
  })

  it('reports a reserved name as an error (kind reserved)', async () => {
    writeCommand('version.ts', VALID())
    const res = await resolveCustomCommand(projectRoot, 'version')
    expect(res?.def).toBeUndefined()
    expect(res?.error).toMatchObject({ name: 'version', kind: 'reserved' })
  })

  it('reports an unusable command as an error (kind invalid)', async () => {
    writeCommand('broken.ts', `export default { description: 'no run' }`)
    const res = await resolveCustomCommand(projectRoot, 'broken')
    expect(res?.error).toMatchObject({ name: 'broken', kind: 'invalid' })
  })

  it('picks the same winner as the full loader on a collision', async () => {
    writeCommand('dup.mjs', VALID('First wins.'))
    writeCommand('dup.ts', VALID('Second loses.'))
    const res = await resolveCustomCommand(projectRoot, 'dup')
    expect(res?.def?.description).toBe('First wins.')
  })
})
