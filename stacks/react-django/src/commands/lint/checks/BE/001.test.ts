import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './001'

const BASE = 'backend/config/settings/base.py'

describe('BE001 — apps ↔ LOCAL_APPS parity', () => {
  it('returns nothing when backend/apps is absent', () => {
    expect(check(makeProject({ 'frontend/.keep': '' }))).toEqual([])
  })

  it('passes when disk apps and LOCAL_APPS match', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      [BASE]: 'LOCAL_APPS = [\n    "apps.core",\n]\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a disk app missing from LOCAL_APPS', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/files/apps.py': '',
      [BASE]: 'LOCAL_APPS = [\n    "apps.core",\n]\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('apps.files')
  })

  it('flags a LOCAL_APPS entry with no matching directory', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      [BASE]: 'LOCAL_APPS = [\n    "apps.core",\n    "apps.ghost",\n]\n',
    })
    expect(messages(check(root)).join()).toContain('apps.ghost')
  })

  it('errors when LOCAL_APPS cannot be found', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      [BASE]: 'INSTALLED_APPS = []\n',
    })
    expect(messages(check(root)).join()).toContain('LOCAL_APPS')
  })
})
