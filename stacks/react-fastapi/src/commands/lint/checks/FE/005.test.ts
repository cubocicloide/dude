import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './005'

const P = 'frontend/src/pages'

describe('FE005 — page directory structure and route naming', () => {
  it('passes for a fully structured page tree', () => {
    const root = makeProject({
      [`${P}/index.tsx`]: '',
      [`${P}/styles.module.css`]: '',
      [`${P}/constants.tsx`]: '',
      [`${P}/users/index.tsx`]: '',
      [`${P}/users/[id]/index.tsx`]: '',
      [`${P}/users/$components/UserTable/index.tsx`]: '',
      [`${P}/users/$hooks/useUsers/index.tsx`]: '',
      [`${P}/users/$assets/empty-state.svg`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('warns on an unexpected file in a page dir', () => {
    const root = makeProject({
      [`${P}/index.tsx`]: '',
      [`${P}/helpers.ts`]: '',
    })
    expect(messages(check(root))).toContain(
      'Unexpected file "helpers.ts" in page directory. Allowed: index.tsx, styles.module.css, types.tsx, constants.tsx, functions.tsx',
    )
  })

  it('errors on a non-kebab route segment', () => {
    const root = makeProject({ [`${P}/UserSettings/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      'Route segment "UserSettings" must be kebab-case (e.g. "user-settings") or a dynamic [param] segment (e.g. "[id]")',
    )
  })

  it('accepts kebab-case and [param] segments', () => {
    const root = makeProject({
      [`${P}/user-settings/index.tsx`]: '',
      [`${P}/user-settings/[tabId]/index.tsx`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors on a reserved unprefixed segment', () => {
    const root = makeProject({ [`${P}/users/components/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      'Route segment "components" conflicts with the structural directories — use the privileged "$components" folder, or pick a different route name',
    )
  })

  it('errors on an unknown privileged directory', () => {
    const root = makeProject({ [`${P}/$stuff/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      'Unknown privileged directory "$stuff" in page directory. Allowed: $components/, $hooks/, $assets/, $misc/',
    )
  })

  it('warns on a route dir without index.tsx or nested routes', () => {
    const root = makeProject({ [`${P}/empty/styles.module.css`]: '' })
    expect(messages(check(root))).toContain(
      'Route directory "empty" has no index.tsx and no nested routes',
    )
  })

  it('does not warn on a pass-through segment with nested routes', () => {
    const root = makeProject({ [`${P}/admin/users/index.tsx`]: '' })
    expect(check(root)).toEqual([])
  })
})
