import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './005'

const S = 'e2e/steps'
const PG = 'e2e/pages'

describe('E2E005 — imported page objects exist', () => {
  it('passes when the imported page object exists', () => {
    const root = makeProject({
      [`${PG}/LoginPage.ts`]: '',
      [`${S}/login.steps.ts`]: "import { LoginPage } from '../pages/LoginPage'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('errors on an import of a missing page object, with the right line', () => {
    const root = makeProject({
      [`${PG}/LoginPage.ts`]: '',
      [`${S}/login.steps.ts`]: "// header\nimport { GhostPage } from '@pages/GhostPage'\n",
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.message).toContain('Imported page object "GhostPage" not found')
    expect(diags[0]!.line).toBe(2)
  })
})
