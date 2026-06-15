import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check, { stemToExpectedPath, allowedHandlerName } from './007'

describe('BE007 helpers', () => {
  it.each([
    ['health', '/health'],
    ['todos', '/todos'],
    ['todos__id', '/todos/{id}'],
    ['users_me', '/users/me'],
    ['keycloak_token', '/keycloak/token'],
  ])('stemToExpectedPath(%s) === %s', (stem, expected) => {
    expect(stemToExpectedPath(stem)).toBe(expected)
  })

  it('allowedHandlerName joins method and stem', () => {
    expect(allowedHandlerName('get', 'todos__id')).toBe('get_todos__id')
  })
})

describe('BE007 — router handler rules', () => {
  it('passes a correctly-named, correctly-pathed handler', () => {
    const root = makeProject({
      'backend/app/routers/todos__id.py':
        '@router.get("/todos/{id}")\nasync def get_todos__id():\n    pass\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a non-route (undecorated) function', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': 'def helper():\n    pass\n',
    })
    expect(messages(check(root))).toContain(
      '`helper` is not a route handler — only @router.METHOD-decorated functions are allowed in router files',
    )
  })

  it('flags a wrongly-named handler', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': '@router.get("/todos")\nasync def fetch_items():\n    pass\n',
    })
    expect(messages(check(root))).toContain('route handler `fetch_items` should be named `get_todos`')
  })

  it('flags a mismatched declared path', () => {
    const root = makeProject({
      'backend/app/routers/todos.py': '@router.get("/wrong")\nasync def get_todos():\n    pass\n',
    })
    expect(messages(check(root))).toContain(
      'route path `/wrong` does not match expected `/todos` (derived from `todos.py`)',
    )
  })
})
