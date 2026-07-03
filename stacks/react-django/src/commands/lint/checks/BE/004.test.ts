import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './004'

describe('BE004 — no raw SQL', () => {
  it('passes ORM-only code', () => {
    const root = makeProject({
      'backend/apps/core/services.py': 'User.objects.filter(active=True)\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags cursor.execute(', () => {
    const root = makeProject({
      'backend/apps/core/services.py': 'cursor.execute("DELETE FROM users")\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('Raw SQL')
  })

  it('flags .raw( and RawSQL(', () => {
    const root = makeProject({
      'backend/apps/core/queries.py': 'User.objects.raw("SELECT * FROM users")\n',
      'backend/apps/core/utils.py': 'RawSQL("SELECT 1", [])\n',
    })
    expect(check(root)).toHaveLength(2)
  })
})
