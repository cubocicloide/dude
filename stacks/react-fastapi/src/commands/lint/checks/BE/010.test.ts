import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './010'

describe('BE010 — one model class per file', () => {
  it('passes for exactly one correctly-named class', () => {
    const root = makeProject({
      'backend/app/models/user_profile.py': 'class UserProfile:\n    pass\n',
    })
    expect(check(root)).toEqual([])
  })

  it('errors when the file defines no class', () => {
    const root = makeProject({ 'backend/app/models/group.py': 'x = 1\n' })
    expect(messages(check(root))).toContain(
      'models/group.py defines no class — expected exactly one class named `Group`',
    )
  })

  it('errors when the file defines multiple classes', () => {
    const root = makeProject({
      'backend/app/models/group.py': 'class Group:\n    pass\nclass Other:\n    pass\n',
    })
    expect(messages(check(root)).some((m) => m.includes('defines 2 classes'))).toBe(true)
  })

  it('errors when the single class has the wrong name', () => {
    const root = makeProject({
      'backend/app/models/group.py': 'class Team:\n    pass\n',
    })
    expect(messages(check(root))).toContain(
      'class `Team` in models/group.py must be named `Group` to match the file name',
    )
  })
})
