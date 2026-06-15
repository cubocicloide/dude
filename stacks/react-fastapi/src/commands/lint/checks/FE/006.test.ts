import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './006'

const H = 'frontend/src/hooks'

describe('FE006 — hook dir contents', () => {
  it('passes for index.tsx and types.tsx in a use* dir', () => {
    const root = makeProject({
      [`${H}/useAuth/index.tsx`]: '',
      [`${H}/useAuth/types.tsx`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('only inspects use* directories', () => {
    const root = makeProject({ [`${H}/helpers/util.ts`]: '' })
    expect(check(root)).toEqual([])
  })

  it('warns about an unexpected file in a hook dir', () => {
    const root = makeProject({
      [`${H}/useAuth/index.tsx`]: '',
      [`${H}/useAuth/styles.module.css`]: '',
    })
    expect(messages(check(root))).toContain(
      'Unexpected file "styles.module.css" in hook directory. Allowed: index.tsx, types.tsx',
    )
  })
})
