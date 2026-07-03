import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './004'

const P = 'frontend/src/pages'
const APP = 'frontend/src/App.tsx'

describe('FE004 — App.tsx page imports', () => {
  it('passes when imports and page dirs line up', () => {
    const root = makeProject({
      [`${P}/Home/index.tsx`]: '',
      [APP]: "import Home from '@/pages/Home'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('errors when App.tsx imports a non-existent page', () => {
    const root = makeProject({
      [`${P}/Home/index.tsx`]: '',
      [APP]: "import Ghost from '@/pages/Ghost'\n",
    })
    expect(messages(check(root))).toContain(
      'App.tsx imports page "Ghost" but pages/Ghost/ does not exist',
    )
  })

  it('warns when a page dir is not imported', () => {
    const root = makeProject({
      [`${P}/Home/index.tsx`]: '',
      [`${P}/About/index.tsx`]: '',
      [APP]: "import Home from '@/pages/Home'\n",
    })
    const diags = check(root)
    const warn = diags.find((d) => d.message.includes('About'))
    expect(warn!.severity).toBe('warning')
    expect(warn!.message).toContain('pages/About/ exists but is not imported in App.tsx')
  })

  it('handles relative ../pages imports', () => {
    const root = makeProject({
      [`${P}/Home/index.tsx`]: '',
      [APP]: "import Home from '../pages/Home'\n",
    })
    expect(check(root)).toEqual([])
  })
})
