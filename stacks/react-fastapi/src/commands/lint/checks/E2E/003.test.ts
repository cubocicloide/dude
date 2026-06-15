import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './003'

const F = 'e2e/features'
const S = 'e2e/steps'

describe('E2E003 — step file has matching feature', () => {
  it('passes when the feature exists', () => {
    const root = makeProject({
      [`${F}/login.feature`]: '',
      [`${S}/login.steps.ts`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('exempts common.steps.ts', () => {
    const root = makeProject({
      [`${F}/.keep`]: '',
      [`${S}/common.steps.ts`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors on an orphaned step file', () => {
    const root = makeProject({
      [`${F}/.keep`]: '',
      [`${S}/ghost.steps.ts`]: '',
    })
    expect(messages(check(root))).toContain(
      'Step file "ghost.steps.ts" has no matching feature. Expected: e2e/features/ghost.feature',
    )
  })
})
