import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './002'

const C = 'frontend/src/components'

describe('FE002 — component dir contents', () => {
  it('passes for the allowed set', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Card/styles.module.css`]: '',
      [`${C}/Card/types.tsx`]: '',
      [`${C}/Card/components/.keep`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('warns about an unexpected file', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Card/helper.ts`]: '',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
    expect(diags[0]!.message).toContain('Unexpected file "helper.ts"')
  })
})
