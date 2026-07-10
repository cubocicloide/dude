import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './011'

describe('FE011 — $misc usage is discouraged', () => {
  it('is silent when no $misc exists', () => {
    const root = makeProject({ 'frontend/src/$components/Card/index.tsx': '' })
    expect(check(root)).toEqual([])
  })

  it('warns once per $misc directory', () => {
    const root = makeProject({
      'frontend/src/$components/Card/$misc/one.txt': '',
      'frontend/src/pages/users/$misc/two.txt': '',
    })
    const diags = check(root)
    expect(diags).toHaveLength(2)
    expect(diags.every((d) => d.severity === 'warning')).toBe(true)
    expect(diags[0]!.message).toContain('Avoid $misc')
    expect(diags[0]!.message).toContain('components → $components/')
  })

  it('never escalates to an error, even for nested content', () => {
    const root = makeProject({
      'frontend/src/utils/$misc/deep/weird/File.Name.PNG': '',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
  })
})
