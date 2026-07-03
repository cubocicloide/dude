import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './001'

const F = 'e2e/features'

describe('E2E001 — feature file naming', () => {
  it('returns nothing when features/ is absent', () => {
    expect(check(makeProject())).toEqual([])
  })

  it('passes snake_case feature names (incl. nested dirs)', () => {
    const root = makeProject({
      [`${F}/login.feature`]: '',
      [`${F}/auth/sign_up.feature`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a non-snake_case feature name', () => {
    const root = makeProject({ [`${F}/LoginFlow.feature`]: '' })
    expect(messages(check(root))).toContain(
      'Feature file "LoginFlow.feature" must use snake_case (got "LoginFlow").',
    )
  })
})
