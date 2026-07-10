import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './003'

const C = 'frontend/src/$components'

describe('FE003 — $components barrel exports', () => {
  it('passes when the barrel exports every component', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/index.tsx`]: "export { default as Card } from './Card'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('errors when the barrel is missing', () => {
    const root = makeProject({ [`${C}/Card/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      '$components/ is missing its index.tsx barrel (must export: Card)',
    )
  })

  it('errors when a component is not exported', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Badge/index.tsx`]: '',
      [`${C}/index.tsx`]: "export { default as Card } from './Card'\n",
    })
    expect(messages(check(root))).toContain(
      '$components/index.tsx is missing a barrel export for "Badge"',
    )
  })

  it('requires barrels in nested $components too', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/index.tsx`]: "export { default as Card } from './Card'\n",
      [`${C}/Card/$components/Avatar/index.tsx`]: '',
    })
    expect(messages(check(root))).toContain(
      '$components/ is missing its index.tsx barrel (must export: Avatar)',
    )
  })

  it('is silent for an empty $components/', () => {
    const root = makeProject({ [`${C}/`]: null })
    expect(check(root)).toEqual([])
  })
})
