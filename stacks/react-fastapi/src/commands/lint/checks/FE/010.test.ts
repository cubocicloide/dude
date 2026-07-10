import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './010'

const S = 'frontend/src'

describe('FE010 — src root layout and $types', () => {
  it('passes for the canonical root layout', () => {
    const root = makeProject({
      [`${S}/App.tsx`]: '',
      [`${S}/main.tsx`]: '',
      [`${S}/styles.module.css`]: '',
      [`${S}/$types/vite-env.d.ts`]: '',
      [`${S}/$components/index.tsx`]: '',
      [`${S}/$hooks/index.tsx`]: '',
      [`${S}/openapi/utils/openapi.yaml`]: '',
      [`${S}/pages/index.tsx`]: '',
      [`${S}/utils/index.tsx`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors on legacy layout entries with a migration hint', () => {
    const root = makeProject({
      [`${S}/components/Card/index.tsx`]: '',
      [`${S}/hooks/useFoo/index.tsx`]: '',
      [`${S}/assets/logo.svg`]: '',
      [`${S}/index.css`]: '',
      [`${S}/vite-env.d.ts`]: '',
    })
    const msgs = messages(check(root))
    expect(msgs).toContain('"components" belongs to the legacy frontend layout — move it to $components/')
    expect(msgs).toContain('"hooks" belongs to the legacy frontend layout — move it to $hooks/')
    expect(msgs).toContain(
      '"assets" belongs to the legacy frontend layout — move each asset into the $assets/ folder of its owning scope',
    )
    expect(msgs).toContain('"index.css" belongs to the legacy frontend layout — rename it to styles.module.css')
    expect(msgs).toContain(
      '"vite-env.d.ts" belongs to the legacy frontend layout — move it to $types/vite-env.d.ts',
    )
  })

  it('errors on unexpected root entries', () => {
    const root = makeProject({
      [`${S}/helpers.ts`]: '',
      [`${S}/stores/index.tsx`]: '',
    })
    const diags = check(root)
    expect(diags.every((d) => d.severity === 'error')).toBe(true)
    const msgs = messages(diags)
    expect(msgs).toContain(
      'Unexpected file "helpers.ts" at src root. Allowed: App.tsx, main.tsx, styles.module.css',
    )
    expect(msgs).toContain(
      'Unexpected directory "stores" at src root. Allowed: $types/, $components/, $hooks/, openapi/, pages/, utils/',
    )
  })

  it('errors on non-declaration files inside $types/', () => {
    const root = makeProject({ [`${S}/$types/helpers.ts`]: '' })
    expect(messages(check(root))).toContain(
      '"helpers.ts" is not allowed in $types/ — the folder may only contain *.d.ts declaration files',
    )
  })

  it('errors on stray *.d.ts outside $types/', () => {
    const root = makeProject({ [`${S}/pages/globals.d.ts`]: '' })
    expect(messages(check(root))).toContain(
      'Type declaration "globals.d.ts" must live in frontend/src/$types/',
    )
  })
})
