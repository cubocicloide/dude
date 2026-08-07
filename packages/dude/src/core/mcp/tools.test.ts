/**
 * Unit tests for the MCP tool derivation and the exposure gate.
 *
 * The gate is the security boundary of `dude mcp`: everything else is a
 * convenience. These run against a hand-built catalog rather than a real
 * project, so the rules are stated rather than inferred from whatever the
 * fixture stack happens to register.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveTools,
  isExposed,
  exposureSet,
  toolName,
  DEFAULT_EXPOSED,
  type CatalogJson,
} from './tools.js'

const cmd = (name: string, args: CatalogJson['commands'][number]['args'] = []) => ({
  name,
  description: `${name} description`,
  args,
})

const catalog: CatalogJson = {
  dudeVersion: '0.16.0',
  stack: 'react-fastapi',
  commands: [
    cmd('lint', [
      { name: 'quiet', type: 'boolean', description: 'errors only' },
      { name: 'format', type: 'string', description: 'human|json' },
    ]),
    cmd('explain', [{ name: 'code', type: 'positional', description: 'the code', required: true }]),
    cmd('info'),
    cmd('version'),
    cmd('cheatsheet', [
      { name: 'format', type: 'string', description: 'md|json' },
      { name: 'out', type: 'string', description: 'write to this file' },
    ]),
    cmd('up', [{ name: 'build', type: 'boolean', description: 'rebuild' }]),
    cmd('down'),
    cmd('test'),
    cmd('help'),
  ],
  groups: [
    { name: 'api', subcommands: [cmd('review'), cmd('sync')] },
    { name: 'iac', subcommands: [cmd('destroy'), cmd('output')] },
  ],
  projectCommands: [cmd('hello')],
}

const names = (opts = {}) => deriveTools(catalog, opts).map((t) => t.name)

describe('toolName', () => {
  it('prefixes with dude and joins a group invocation', () => {
    expect(toolName(['lint'])).toBe('dude_lint')
    expect(toolName(['api', 'review'])).toBe('dude_api_review')
  })
})

describe('deriveTools — the default (read-only) surface', () => {
  it('exposes exactly the read-only set, plus the synthetic catalog tool', () => {
    expect(names().sort()).toEqual(
      [
        'dude_catalog',
        'dude_lint',
        'dude_explain',
        'dude_info',
        'dude_version',
        'dude_cheatsheet',
        'dude_api_review',
      ].sort(),
    )
  })

  it('withholds mutating and destructive commands', () => {
    const got = names()
    for (const withheld of ['dude_up', 'dude_down', 'dude_test', 'dude_api_sync', 'dude_iac_destroy']) {
      expect(got).not.toContain(withheld)
    }
  })

  it('never exposes project-local commands by default — dude cannot know what they do', () => {
    expect(names()).not.toContain('dude_hello')
  })

  it('does not emit a `help` tool, since `catalog` already covers it', () => {
    expect(names()).not.toContain('dude_help')
  })
})

describe('deriveTools — structured output', () => {
  it('forces `--format json` on lint so the agent gets data, not prose', () => {
    const lint = deriveTools(catalog).find((t) => t.name === 'dude_lint')
    expect(lint?.jsonArgs).toEqual(['--format', 'json'])
  })

  it('withholds `--format` from lint, so the agent cannot break the JSON contract', () => {
    const lint = deriveTools(catalog).find((t) => t.name === 'dude_lint')
    expect(Object.keys(lint!.inputSchema.properties)).toEqual(['quiet'])
  })

  it('withholds cheatsheet `--out`, which would make a read-only tool write a file', () => {
    const sheet = deriveTools(catalog).find((t) => t.name === 'dude_cheatsheet')
    expect(Object.keys(sheet!.inputSchema.properties)).toEqual([])
  })
})

describe('deriveTools — input schema', () => {
  it('maps arg types and carries required through', () => {
    const explain = deriveTools(catalog).find((t) => t.name === 'dude_explain')
    expect(explain!.inputSchema).toMatchObject({
      type: 'object',
      properties: { code: { type: 'string', description: 'the code' } },
      required: ['code'],
    })
  })

  it('maps boolean args to boolean', () => {
    const lint = deriveTools(catalog).find((t) => t.name === 'dude_lint')
    expect(lint!.inputSchema.properties.quiet).toEqual({ type: 'boolean', description: 'errors only' })
  })
})

describe('deriveTools — opting in', () => {
  it('exposes a named command via `expose`', () => {
    expect(names({ expose: ['test'] })).toContain('dude_test')
  })

  it('exposes a group subcommand via its "<group> <sub>" name', () => {
    const got = names({ expose: ['api sync'] })
    expect(got).toContain('dude_api_sync')
    expect(got).not.toContain('dude_iac_destroy')
  })

  it('passes an opted-in command through with its full argument set', () => {
    const up = deriveTools(catalog, { expose: ['up'] }).find((t) => t.name === 'dude_up')
    expect(Object.keys(up!.inputSchema.properties)).toEqual(['build'])
  })

  it('`allowMutating` exposes everything, including destructive commands', () => {
    const got = names({ allowMutating: true })
    expect(got).toContain('dude_iac_destroy')
    expect(got).toContain('dude_down')
    expect(got).toContain('dude_hello')
  })
})

describe('isExposed — the gate itself', () => {
  it('allows the read-only defaults', () => {
    expect(isExposed(['lint'])).toBe(true)
    expect(isExposed(['api', 'review'])).toBe(true)
  })

  it('denies anything else by default', () => {
    expect(isExposed(['down'])).toBe(false)
    expect(isExposed(['iac', 'destroy'])).toBe(false)
    expect(isExposed(['test'])).toBe(false)
  })

  it('honours an explicit opt-in', () => {
    expect(isExposed(['test'], { expose: ['test'] })).toBe(true)
    expect(isExposed(['iac', 'destroy'], { expose: ['iac destroy'] })).toBe(true)
  })

  it('opting one command in does not open the rest', () => {
    expect(isExposed(['down'], { expose: ['test'] })).toBe(false)
  })

  it('allowMutating opens everything', () => {
    expect(isExposed(['iac', 'destroy'], { allowMutating: true })).toBe(true)
  })

  it('exposureSet is the defaults plus the opt-ins', () => {
    expect(exposureSet()).toEqual(new Set(DEFAULT_EXPOSED))
    expect(exposureSet({ expose: ['test'] }).has('test')).toBe(true)
  })
})
