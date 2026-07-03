import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './008'

describe('FE008 — static assets location', () => {
  it('passes when assets live under assets/', () => {
    const root = makeProject({ 'frontend/src/assets/logo.svg': '' })
    expect(check(root)).toEqual([])
  })

  it('errors on an asset outside assets/', () => {
    const root = makeProject({ 'frontend/src/components/Card/icon.png': '' })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('Asset "icon.png" must be in frontend/src/assets/')
  })

  it('ignores non-asset files', () => {
    const root = makeProject({ 'frontend/src/components/Card/index.tsx': '' })
    expect(check(root)).toEqual([])
  })
})
