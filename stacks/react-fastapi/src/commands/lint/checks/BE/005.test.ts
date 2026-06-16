import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './005'

describe('BE005 — main.py imports & includes every router', () => {
  it('passes when every router is imported and included', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': 'router = APIRouter()\n',
      'backend/app/main.py': 'from app.routers import todos\napp.include_router(todos.router)\n',
    })
    expect(check(root)).toEqual([])
  })

  it('warns when a router exists but is neither imported nor included', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': 'router = APIRouter()\n',
      'backend/app/main.py': '# empty\n',
    })
    const diags = check(root)
    const msgs = messages(diags)
    expect(msgs).toContain('routers/todos.py exists but is not imported in main.py')
    expect(msgs).toContain('routers/todos.router is not registered via include_router() in main.py')
    expect(diags.every((d) => d.severity === 'warning')).toBe(true)
  })

  it('errors when main.py imports a router that does not exist', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': 'router = APIRouter()\n',
      'backend/app/main.py':
        'from app.routers import (\n    todos,\n    ghosts,\n)\napp.include_router(todos.router)\napp.include_router(ghosts.router)\n',
    })
    const msgs = messages(check(root))
    expect(msgs).toContain(
      'main.py imports `ghosts` from app.routers but routers/ghosts.py does not exist',
    )
    expect(msgs).toContain(
      'main.py calls include_router(ghosts.router) but routers/ghosts.py does not exist',
    )
  })

  it('parses a multi-line parenthesised import block', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': 'router = APIRouter()\n',
      'backend/app/routers/users.py': 'router = APIRouter()\n',
      'backend/app/main.py':
        'from app.routers import (\n    todos,\n    users,\n)\napp.include_router(todos.router)\napp.include_router(users.router)\n',
    })
    expect(check(root)).toEqual([])
  })
})
