import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './001'

const C = 'frontend/src/$components'

describe('FE001 — $components directories are PascalCase', () => {
  it('returns nothing when no $components/ exists', () => {
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

  it('ignores files at the $components/ root', () => {
    const root = makeProject({ [`${C}/index.tsx`]: '' })
    expect(check(root)).toEqual([])
  })

  it('checks nested $components (matrioska)', () => {
    const root = makeProject({ [`${C}/Card/$components/bad_name/index.tsx`]: '' })
    expect(messages(check(root))).toContain('Component directory "bad_name" must be PascalCase')
  })

  it('checks page-local $components', () => {
    const root = makeProject({
      'frontend/src/pages/users/$components/bad_name/index.tsx': '',
    })
    expect(messages(check(root))).toContain('Component directory "bad_name" must be PascalCase')
  })

  it('flags privileged dirs directly inside $components/', () => {
    const root = makeProject({ [`${C}/$assets/logo.svg`]: '' })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.message).toContain('not allowed directly inside $components/')
  })

  it('skips anything inside $misc', () => {
    const root = makeProject({
      'frontend/src/$components/Card/$misc/$components/bad_name/index.tsx': '',
    })
    expect(check(root)).toEqual([])
  })
})
