import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './012'

describe('BE012 — no print()', () => {
  it('passes logging-based code', () => {
    const root = makeProject({
      'backend/apps/core/views.py': 'logger.info("hello")\n',
    })
    expect(check(root)).toEqual([])
  })

  it('warns on print() in app code (apps/ and config/)', () => {
    const root = makeProject({
      'backend/apps/core/services.py': 'print("debug")\n',
      'backend/config/settings/base.py': 'print("boot")\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(2)
    expect(diags.every((d) => d.severity === 'warning')).toBe(true)
  })

  it('ignores tests and migrations', () => {
    const root = makeProject({
      'backend/apps/core/tests/test_views.py': 'print("ok in tests")\n',
      'backend/apps/core/migrations/0001_initial.py': 'print("ok in migrations")\n',
    })
    expect(check(root)).toEqual([])
  })
})
