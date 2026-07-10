import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './008'

describe('FE008 — assets live in $assets/ folders', () => {
  it('passes when assets live under a $assets/', () => {
    const root = makeProject({
      'frontend/src/$components/Layout/$assets/logo.svg': '',
      'frontend/src/pages/users/$assets/empty-state.png': '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors on an asset outside $assets/', () => {
    const root = makeProject({ 'frontend/src/$components/Card/icon.png': '' })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('Asset "icon.png" must live in a $assets/ directory')
  })

  it('errors on code files inside $assets/', () => {
    const root = makeProject({ 'frontend/src/$components/Card/$assets/helper.ts': '' })
    expect(messages(check(root))).toContain(
      '"helper.ts" is not a static asset — $assets/ may only contain asset files (images, fonts, media, documents, data), never code',
    )
  })

  it('warns on a non-kebab-case asset name', () => {
    const root = makeProject({ 'frontend/src/$components/Card/$assets/MyLogo.svg': '' })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
    expect(diags[0]!.message).toContain(
      'Asset "MyLogo.svg" should be kebab-case with a lowercase extension',
    )
  })

  it('allows kebab-case subdirectories inside $assets/', () => {
    const root = makeProject({
      'frontend/src/$components/Card/$assets/brand-icons/logo-dark.svg': '',
    })
    expect(check(root)).toEqual([])
  })

  it('ignores non-asset files outside $assets/', () => {
    const root = makeProject({ 'frontend/src/$components/Card/index.tsx': '' })
    expect(check(root)).toEqual([])
  })

  it('ignores anything inside $misc', () => {
    const root = makeProject({ 'frontend/src/$components/Card/$misc/photo.png': '' })
    expect(check(root)).toEqual([])
  })
})
