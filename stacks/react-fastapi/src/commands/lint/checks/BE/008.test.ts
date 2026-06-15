import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './008'

describe('BE008 — source ↔ test coverage', () => {
  it('returns nothing when tests/ is absent', () => {
    const root = makeProject({ 'backend/app/models/todo.py': '' })
    expect(check(root)).toEqual([])
  })

  it('passes when every source has a matching test', () => {
    const root = makeProject({
      'backend/app/models/todo.py': '',
      'backend/app/tests/models/test_todo.py': '',
    })
    expect(check(root)).toEqual([])
  })

  it('warns when a source file has no test', () => {
    const root = makeProject({
      'backend/app/models/todo.py': '',
      'backend/app/tests/.keep': '',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
    expect(diags[0]!.message).toContain('tests/models/test_todo.py is missing')
  })

  it('errors on an orphaned test file', () => {
    const root = makeProject({
      'backend/app/tests/models/test_ghost.py': '',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('`test_ghost.py` has no corresponding `models/ghost.py`')
  })
})
