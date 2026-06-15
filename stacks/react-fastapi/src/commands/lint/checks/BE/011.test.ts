import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './011'

describe('BE011 — query class prefixes', () => {
  it('accepts multiple classes sharing the filename prefix', () => {
    const root = makeProject({
      'backend/app/queries/todos.py': 'class Todos:\n    pass\nclass TodosList:\n    pass\n',
    })
    expect(check(root)).toEqual([])
  })

  it('errors when there are no classes', () => {
    const root = makeProject({ 'backend/app/queries/todos.py': 'x = 1\n' })
    expect(messages(check(root))).toContain(
      'queries/todos.py defines no classes — expected at least one class starting with `Todos`',
    )
  })

  it('errors on a class without the prefix', () => {
    const root = makeProject({
      'backend/app/queries/todos.py': 'class Todos:\n    pass\nclass UserList:\n    pass\n',
    })
    expect(messages(check(root)).some((m) => m.includes('class `UserList`'))).toBe(true)
  })
})
