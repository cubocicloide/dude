import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './007'

const H = 'frontend/src/hooks'

describe('FE007 — hooks barrel exports', () => {
  it('passes when every use* dir is exported', () => {
    const root = makeProject({
      [`${H}/useAuth/index.tsx`]: '',
      [`${H}/index.tsx`]: "export * from './useAuth'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('flags a use* dir missing from the barrel', () => {
    const root = makeProject({
      [`${H}/useAuth/index.tsx`]: '',
      [`${H}/useTheme/index.tsx`]: '',
      [`${H}/index.tsx`]: "export * from './useAuth'\n",
    })
    expect(messages(check(root))).toContain(
      'hooks/index.tsx is missing a barrel export for "useTheme"',
    )
  })
})
