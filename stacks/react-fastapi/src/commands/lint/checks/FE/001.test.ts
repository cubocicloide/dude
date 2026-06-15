import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './001'

const C = 'frontend/src/components'

describe('FE001 — component directories are PascalCase', () => {
  it('returns nothing when components/ is absent', () => {
    expect(check(makeProject())).toEqual([])
  })

  it('passes for PascalCase directories', () => {
    const root = makeProject({ [`${C}/TodoList/index.tsx`]: '' })
    expect(check(root)).toEqual([])
  })

  it('flags a non-PascalCase directory', () => {
    const root = makeProject({ [`${C}/todo-list/index.tsx`]: '' })
    expect(messages(check(root))).toContain('Component directory "todo-list" must be PascalCase')
  })

  it('ignores files at the components/ root', () => {
    const root = makeProject({ [`${C}/index.tsx`]: '' })
    expect(check(root)).toEqual([])
  })
})
