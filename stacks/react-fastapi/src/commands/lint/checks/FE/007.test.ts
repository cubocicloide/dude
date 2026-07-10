import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './007'

const H = 'frontend/src/$hooks'

describe('FE007 — $hooks barrel exports', () => {
  it('passes when the barrel exports every hook', () => {
    const root = makeProject({
      [`${H}/usePageTitle/index.tsx`]: '',
      [`${H}/index.tsx`]: "export { default as usePageTitle } from './usePageTitle'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('errors when the barrel is missing', () => {
    const root = makeProject({ [`${H}/usePageTitle/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      '$hooks/ is missing its index.tsx barrel (must export: usePageTitle)',
    )
  })

  it('errors when a hook is not exported', () => {
    const root = makeProject({
      [`${H}/usePageTitle/index.tsx`]: '',
      [`${H}/useCounterStore/index.tsx`]: '',
      [`${H}/index.tsx`]: "export { default as usePageTitle } from './usePageTitle'\n",
    })
    expect(messages(check(root))).toContain(
      '$hooks/index.tsx is missing a barrel export for "useCounterStore"',
    )
  })

  it('requires barrels in nested $hooks (e.g. inside a page)', () => {
    const root = makeProject({
      'frontend/src/pages/users/$hooks/useUsers/index.tsx': '',
    })
    expect(messages(check(root))).toContain(
      '$hooks/ is missing its index.tsx barrel (must export: useUsers)',
    )
  })
})
