import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './002'

const C = 'frontend/src/$components'

describe('FE002 — allowed contents of a component directory', () => {
  it('passes for the full allowed set', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Card/styles.module.css`]: '',
      [`${C}/Card/types.tsx`]: '',
      [`${C}/Card/constants.tsx`]: '',
      [`${C}/Card/functions.tsx`]: '',
      [`${C}/Card/$components/Avatar/index.tsx`]: '',
      [`${C}/Card/$hooks/useCard/index.tsx`]: '',
      [`${C}/Card/$assets/icon.svg`]: '',
      [`${C}/Card/$misc/scratch.txt`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors when index.tsx is missing', () => {
    const root = makeProject({ [`${C}/Card/types.tsx`]: '' })
    expect(messages(check(root))).toContain('Component "Card" is missing its index.tsx')
  })

  it('warns on an unexpected file', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Card/utils.ts`]: '',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
    expect(diags[0]!.message).toContain('Unexpected file "utils.ts"')
  })

  it('warns on an unprefixed components/ directory', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Card/components/Avatar/index.tsx`]: '',
    })
    expect(messages(check(root))).toContain(
      'Unexpected directory "components" in component directory. Allowed: $components/, $hooks/, $assets/, $misc/',
    )
  })

  it('checks nested component dirs (matrioska)', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Card/$components/Avatar/index.tsx`]: '',
      [`${C}/Card/$components/Avatar/helpers.ts`]: '',
    })
    expect(messages(check(root))).toContain(
      'Unexpected file "helpers.ts" in component directory. Allowed: index.tsx, styles.module.css, types.tsx, constants.tsx, functions.tsx',
    )
  })
})
