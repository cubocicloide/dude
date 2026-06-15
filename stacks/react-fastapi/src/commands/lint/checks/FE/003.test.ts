import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './003'

const C = 'frontend/src/components'

describe('FE003 — components barrel exports', () => {
  it('returns nothing when the barrel file is missing', () => {
    const root = makeProject({ [`${C}/Card/index.tsx`]: '' })
    expect(check(root)).toEqual([])
  })

  it('passes when every PascalCase dir is exported', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/index.tsx`]: "export * from './Card'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('flags a directory missing from the barrel', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/Modal/index.tsx`]: '',
      [`${C}/index.tsx`]: "export * from './Card'\n",
    })
    expect(messages(check(root))).toContain(
      'components/index.tsx is missing a barrel export for "Modal"',
    )
  })

  it('accepts double-quoted import paths', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: '',
      [`${C}/index.tsx`]: 'export * from "./Card"\n',
    })
    expect(check(root)).toEqual([])
  })
})
