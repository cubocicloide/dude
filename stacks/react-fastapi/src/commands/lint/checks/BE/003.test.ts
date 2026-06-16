import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './003'

describe('BE003 — schema classes extend BaseModel and match prefix', () => {
  it('passes for a Pydantic schema with the right prefix', () => {
    const root = makeProject({
      'backend/app/schemas/todo.py': 'class TodoCreate(BaseModel):\n    pass\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a class that does not extend BaseModel/SQLModel', () => {
    const root = makeProject({
      'backend/app/schemas/todo.py': 'class Todo:\n    pass\n',
    })
    expect(messages(check(root))).toContain(
      'class `Todo` in todo.py must extend BaseModel (or SQLModel) — only Pydantic schemas are allowed in schemas/',
    )
  })

  it('flags a class whose name lacks the filename prefix', () => {
    const root = makeProject({
      'backend/app/schemas/todo.py': 'class UserCreate(BaseModel):\n    pass\n',
    })
    expect(messages(check(root))).toContain(
      'schema class `UserCreate` in todo.py must start with `Todo`',
    )
  })
})
