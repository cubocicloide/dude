import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './014'

describe('BE014 — every app ships tests', () => {
  it('passes an app with tests/ + test file', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/tests/__init__.py': '',
      'backend/apps/core/tests/test_views.py': '',
    })
    expect(check(root)).toEqual([])
  })

  it('flags an app without a tests/ package', () => {
    const root = makeProject({ 'backend/apps/core/apps.py': '' })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('tests/')
  })

  it('flags an empty tests/ package and a missing __init__.py', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/tests/.keep': '',
    })
    const msgs = messages(check(root)).join('\n')
    expect(msgs).toContain('__init__.py')
    expect(msgs).toContain('test_*.py')
  })

  it('accepts nested test files', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/tests/__init__.py': '',
      'backend/apps/core/tests/unit/test_deep.py': '',
    })
    expect(check(root)).toEqual([])
  })
})
