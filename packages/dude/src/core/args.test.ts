/**
 * Unit tests for `parseRawArgs`.
 *
 * Positional binding is the reason this module exists: bare words used to be
 * parsed and thrown away, so `dude explain BE003` could never see its code.
 */
import { describe, it, expect } from 'vitest'
import { parseRawArgs } from './args.js'
import type { StackCommandArg } from './stack-contract.js'

const spec = (s: Record<string, StackCommandArg>) => s

describe('parseRawArgs — flags', () => {
  it('binds --flag=value', () => {
    expect(parseRawArgs(['--format=json'])).toMatchObject({ format: 'json' })
  })

  it('binds --flag value', () => {
    expect(parseRawArgs(['--format', 'json'])).toMatchObject({ format: 'json' })
  })

  it('binds a trailing bare --flag as true', () => {
    expect(parseRawArgs(['--quiet'])).toMatchObject({ quiet: true })
  })

  it('binds --flag as true when the next token is another flag', () => {
    expect(parseRawArgs(['--quiet', '--format', 'json'])).toMatchObject({
      quiet: true,
      format: 'json',
    })
  })
})

describe('parseRawArgs — declared boolean flags', () => {
  const args = spec({
    quiet: { type: 'boolean' },
    code: { type: 'positional' },
  })

  it('does not let a declared boolean swallow the following positional', () => {
    // The whole point: `dude explain --quiet BE003` must still see BE003.
    expect(parseRawArgs(['--quiet', 'BE003'], args)).toMatchObject({
      quiet: true,
      code: 'BE003',
    })
  })

  it('an undeclared flag still consumes the next word', () => {
    // Nothing declares it, so there is no basis for treating it as a switch.
    expect(parseRawArgs(['--unknown', 'value'])).toMatchObject({ unknown: 'value' })
  })
})

describe('parseRawArgs — positionals', () => {
  const args = spec({ code: { type: 'positional' } })

  it('binds a bare word to the declared positional', () => {
    expect(parseRawArgs(['BE003'], args)).toMatchObject({ code: 'BE003' })
  })

  it('binds several positionals in declaration order', () => {
    const two = spec({
      first: { type: 'positional' },
      second: { type: 'positional' },
    })
    expect(parseRawArgs(['a', 'b'], two)).toMatchObject({ first: 'a', second: 'b' })
  })

  it('leaves an unsupplied positional undefined rather than binding ""', () => {
    expect(parseRawArgs([], args).code).toBeUndefined()
  })

  it('binds positionals that appear after flags', () => {
    expect(parseRawArgs(['--format', 'json', 'BE003'], args)).toMatchObject({
      format: 'json',
      code: 'BE003',
    })
  })

  it('always exposes the raw positional list as _', () => {
    expect(parseRawArgs(['a', 'b'])._).toEqual(['a', 'b'])
    expect(parseRawArgs([])._).toEqual([])
  })

  it('ignores single-dash tokens rather than treating them as positionals', () => {
    expect(parseRawArgs(['-v', 'BE003'], args)._).toEqual(['BE003'])
  })

  it('collects bare words even when the command declares no positionals', () => {
    expect(parseRawArgs(['stray'])._).toEqual(['stray'])
  })
})
