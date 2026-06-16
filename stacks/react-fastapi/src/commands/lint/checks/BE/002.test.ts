import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './002'

describe('BE002 — model class matches filename', () => {
  it('returns nothing when models/ is absent', () => {
    expect(check(makeProject())).toEqual([])
  })

  it('passes when class matches snake→Pascal name', () => {
    const root = makeProject({
      'backend/app/models/todo_item.py': 'class TodoItem:\n    pass\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a class that does not match the filename', () => {
    const root = makeProject({
      'backend/app/models/group.py': 'class Team:\n    pass\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.message).toContain('must define `class Group`')
  })

  it('ignores __init__.py', () => {
    const root = makeProject({
      'backend/app/models/__init__.py': 'x = 1\n',
    })
    expect(check(root)).toEqual([])
  })
})
