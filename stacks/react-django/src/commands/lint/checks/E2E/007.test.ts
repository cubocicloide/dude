import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './007'

const S = 'e2e/steps'

describe('E2E007 — hardcoded URLs in steps', () => {
  it('passes when no URL is present', () => {
    const root = makeProject({
      [`${S}/login.steps.ts`]: 'await page.goto(this.baseUrl)\n',
    })
    expect(check(root)).toEqual([])
  })

  it('warns on a hardcoded URL with the right line number', () => {
    const root = makeProject({
      [`${S}/login.steps.ts`]: 'const x = 1\nawait page.goto("https://example.com")\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
    expect(diags[0]!.line).toBe(2)
    expect(diags[0]!.message).toContain('Hardcoded URL detected')
  })

  it('ignores URLs in comment lines', () => {
    const root = makeProject({
      [`${S}/login.steps.ts`]: '// see https://example.com for details\n',
    })
    expect(check(root)).toEqual([])
  })
})
