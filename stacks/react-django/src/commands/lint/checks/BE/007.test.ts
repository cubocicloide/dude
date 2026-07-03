import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './007'

describe('BE007 — settings hygiene', () => {
  it('passes env-driven settings', () => {
    const root = makeProject({
      'backend/config/settings/base.py': 'DATABASES = {}\n',
      'backend/config/settings/production.py': 'SECRET_KEY = env("DJANGO_SECRET_KEY")\nDEBUG = False\n',
      'backend/config/settings/local.py': 'SECRET_KEY = "dev-insecure-key"\nDEBUG = True\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a hard-coded SECRET_KEY outside local.py', () => {
    const root = makeProject({
      'backend/config/settings/base.py': 'SECRET_KEY = "super-secret"\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
  })

  it('flags DEBUG = True outside local.py', () => {
    const root = makeProject({
      'backend/config/settings/production.py': 'DEBUG = True\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.message).toContain('local.py')
  })
})
