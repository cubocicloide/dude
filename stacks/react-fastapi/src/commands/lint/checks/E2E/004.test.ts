import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './004'

const PG = 'e2e/pages'

describe('E2E004 — page object filenames', () => {
  it('passes for *Page.ts and ignores index.ts', () => {
    const root = makeProject({
      [`${PG}/LoginPage.ts`]: '',
      [`${PG}/index.ts`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a file not following *Page.ts', () => {
    const root = makeProject({ [`${PG}/login.ts`]: '' })
    expect(messages(check(root))).toContain(
      'Page object "login.ts" must follow the *Page.ts convention (e.g. LoginPage.ts).',
    )
  })
})
