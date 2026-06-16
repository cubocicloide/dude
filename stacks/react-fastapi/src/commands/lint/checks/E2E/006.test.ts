import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './006'

describe('E2E006 — required e2e config files', () => {
  it('returns nothing when e2e/ is absent', () => {
    expect(check(makeProject())).toEqual([])
  })

  it('passes when both configs exist', () => {
    const root = makeProject({
      'e2e/playwright.config.ts': '',
      'e2e/cucumber.js': '',
    })
    expect(check(root)).toEqual([])
  })

  it('flags each missing config', () => {
    const root = makeProject({ 'e2e/.keep': '' })
    const msgs = messages(check(root))
    expect(msgs).toContain('Missing Playwright config file: e2e/playwright.config.ts')
    expect(msgs).toContain('Missing Cucumber config file: e2e/cucumber.js')
  })
})
