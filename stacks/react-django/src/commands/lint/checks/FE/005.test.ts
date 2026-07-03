import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './005'

const P = 'frontend/src/pages'

describe('FE005 — page dir contents', () => {
  it('passes for the allowed set', () => {
    const root = makeProject({
      [`${P}/Home/index.tsx`]: '',
      [`${P}/Home/styles.module.css`]: '',
      [`${P}/Home/types.tsx`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('warns about an unexpected file (components/ not allowed in pages)', () => {
    const root = makeProject({
      [`${P}/Home/index.tsx`]: '',
      [`${P}/Home/components/.keep`]: '',
    })
    expect(messages(check(root))).toContain(
      'Unexpected file "components" in page directory. Allowed: index.tsx, styles.module.css, types.tsx',
    )
  })
})
