import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './009'

const U = 'frontend/src/utils'

describe('FE009 — utils domain structure', () => {
  it('passes for scope files at the root plus kebab-case domains', () => {
    const root = makeProject({
      [`${U}/index.tsx`]: '',
      [`${U}/constants.tsx`]: '',
      [`${U}/functions.tsx`]: '',
      [`${U}/formatters/index.tsx`]: '',
      [`${U}/formatters/types.tsx`]: '',
      [`${U}/formatters/$assets/locales.json`]: '',
      [`${U}/$misc/scratch.txt`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors on an unexpected file', () => {
    const root = makeProject({ [`${U}/helpers.ts`]: '' })
    const diags = check(root)
    expect(diags[0]!.severity).toBe('error')
    expect(messages(diags)).toContain(
      'Unexpected file "helpers.ts" in utils. Allowed: index.tsx, styles.module.css, types.tsx, constants.tsx, functions.tsx',
    )
  })

  it('errors on a non-kebab-case domain', () => {
    const root = makeProject({ [`${U}/DateHelpers/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      'Utils domain "DateHelpers" must be kebab-case (e.g. "date-helpers")',
    )
  })

  it('errors when a domain is missing its index.tsx', () => {
    const root = makeProject({ [`${U}/formatters/functions.tsx`]: '' })
    expect(messages(check(root))).toContain('Utils domain "formatters" is missing its index.tsx')
  })

  it('errors on an unknown privileged directory', () => {
    const root = makeProject({ [`${U}/$components/Card/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      'Unknown privileged directory "$components" in utils. Allowed: $assets/, $misc/',
    )
  })

  it('supports nested domains (matrioska)', () => {
    const root = makeProject({
      [`${U}/dates/index.tsx`]: '',
      [`${U}/dates/BadName/index.tsx`]: '',
    })
    expect(messages(check(root))).toContain(
      'Utils domain "BadName" must be kebab-case (e.g. "date-helpers")',
    )
  })
})
