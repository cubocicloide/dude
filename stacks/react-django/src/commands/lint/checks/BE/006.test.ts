import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './006'

describe('BE006 — models require migrations', () => {
  it('passes an app with models and an initial migration', () => {
    const root = makeProject({
      'backend/apps/users/apps.py': '',
      'backend/apps/users/models.py': 'class User(AbstractUser):\n    pass\n',
      'backend/apps/users/migrations/__init__.py': '',
      'backend/apps/users/migrations/0001_initial.py': '',
    })
    expect(check(root)).toEqual([])
  })

  it('passes an app without models', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/views.py': '',
    })
    expect(check(root)).toEqual([])
  })

  it('flags an app defining models but shipping no migrations', () => {
    const root = makeProject({
      'backend/apps/users/apps.py': '',
      'backend/apps/users/models.py': 'from django.db import models\n\nclass Thing(models.Model):\n    pass\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('makemigrations')
  })
})
