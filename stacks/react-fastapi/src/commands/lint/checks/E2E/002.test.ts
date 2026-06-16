import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './002'

const F = 'e2e/features'
const S = 'e2e/steps'

describe('E2E002 — feature has matching step file', () => {
  it('passes when the step file exists', () => {
    const root = makeProject({
      [`${F}/login.feature`]: '',
      [`${S}/login.steps.ts`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors when the step file is missing', () => {
    const root = makeProject({
      [`${F}/login.feature`]: '',
      [`${S}/.keep`]: '',
    })
    expect(messages(check(root))).toContain(
      'No step definitions for "login.feature". Expected: e2e/steps/login.steps.ts',
    )
  })
})
