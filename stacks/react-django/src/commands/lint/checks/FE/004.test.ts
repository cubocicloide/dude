import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './004'

const P = 'frontend/src/pages'
const APP = 'frontend/src/App.tsx'

describe('FE004 — App.tsx page imports', () => {
  it('passes when imports and page nodes line up', () => {
    const root = makeProject({
      [`${P}/index.tsx`]: '',
      [`${P}/users/index.tsx`]: '',
      [APP]: "import HomePage from '@/pages'\nimport UsersPage from '@/pages/users'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('handles dynamic [param] segments', () => {
    const root = makeProject({
      [`${P}/users/[id]/index.tsx`]: '',
      [APP]: "import UserDetailPage from '@/pages/users/[id]'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('errors when App.tsx imports a non-existent page', () => {
    const root = makeProject({
      [`${P}/index.tsx`]: '',
      [APP]: "import HomePage from '@/pages'\nimport Ghost from '@/pages/ghost'\n",
    })
    expect(messages(check(root))).toContain(
      'App.tsx imports page "@/pages/ghost" but frontend/src/pages/ghost/index.tsx does not exist',
    )
  })

  it('warns when a page node is not imported', () => {
    const root = makeProject({
      [`${P}/index.tsx`]: '',
      [`${P}/about/index.tsx`]: '',
      [APP]: "import HomePage from '@/pages'\n",
    })
    const diags = check(root)
    const warn = diags.find((d) => d.message.includes('about'))
    expect(warn!.severity).toBe('warning')
    expect(warn!.message).toContain('pages/about/index.tsx exists but is not imported in App.tsx')
  })

  it('ignores $-prefixed structural dirs when collecting page nodes', () => {
    const root = makeProject({
      [`${P}/index.tsx`]: '',
      [`${P}/$components/Hero/index.tsx`]: '',
      [APP]: "import HomePage from '@/pages'\n",
    })
    expect(check(root)).toEqual([])
  })

  it('handles relative ../pages imports', () => {
    const root = makeProject({
      [`${P}/home/index.tsx`]: '',
      [APP]: "import Home from '../pages/home'\n",
    })
    expect(check(root)).toEqual([])
  })
})
