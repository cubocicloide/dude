import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './006'

describe('BE006 — router filename stems', () => {
  it.each(['health', 'todos', 'todos__id', 'users_me', 'keycloak_token_refresh'])(
    'accepts valid stem %s',
    (stem) => {
      const root = makeProject({ [`backend/app/routers/${stem}.py`]: '' })
      expect(check(root)).toEqual([])
    },
  )

  it.each(['Todos', 'todos-id', 'todos__', '1health', '_todos'])(
    'rejects invalid stem %s',
    (stem) => {
      const root = makeProject({ [`backend/app/routers/${stem}.py`]: '' })
      expect(check(root)).toHaveLength(1)
    },
  )
})
