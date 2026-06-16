import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './004'

describe('BE004 — routers define `router = APIRouter(...)`', () => {
  it('passes when the router is declared', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': 'router = APIRouter()\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a router file missing the declaration', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': '# nothing here\n',
    })
    expect(messages(check(root))).toContain('routers/todos.py must define `router = APIRouter(...)`')
  })
})
