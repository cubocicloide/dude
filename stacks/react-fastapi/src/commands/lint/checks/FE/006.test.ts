import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './006'

const H = 'frontend/src/$hooks'

describe('FE006 — $hooks directory naming and contents', () => {
  it('passes for a full hook directory', () => {
    const root = makeProject({
      [`${H}/useTodoList/index.tsx`]: '',
      [`${H}/useTodoList/types.tsx`]: '',
      [`${H}/useTodoList/constants.tsx`]: '',
      [`${H}/useTodoList/functions.tsx`]: '',
      [`${H}/useTodoList/$assets/fixtures.json`]: '',
      [`${H}/useTodoList/$misc/notes.txt`]: '',
    })
    expect(check(root)).toEqual([])
  })

  it('errors on a non-use* directory', () => {
    const root = makeProject({ [`${H}/todoList/index.tsx`]: '' })
    expect(messages(check(root))).toContain(
      'Hook directory "todoList" must match use[A-Z]… (e.g. useAttachments)',
    )
  })

  it('errors when index.tsx is missing', () => {
    const root = makeProject({ [`${H}/useTodoList/types.tsx`]: '' })
    expect(messages(check(root))).toContain('Hook "useTodoList" is missing its index.tsx')
  })

  it('errors on an unexpected directory inside a hook', () => {
    const root = makeProject({
      [`${H}/useTodoList/index.tsx`]: '',
      [`${H}/useTodoList/$components/Row/index.tsx`]: '',
    })
    const diags = check(root)
    expect(diags[0]!.severity).toBe('error')
    expect(messages(diags)).toContain(
      'Unexpected directory "$components" in hook directory. Allowed: $assets/, $misc/',
    )
  })

  it('errors on privileged dirs directly inside $hooks/', () => {
    const root = makeProject({ [`${H}/$assets/logo.svg`]: '' })
    expect(messages(check(root))).toContain(
      'Privileged directory "$assets" is not allowed directly inside $hooks/ — it belongs inside a hook directory',
    )
  })

  it('checks component-local $hooks too', () => {
    const root = makeProject({
      'frontend/src/$components/Card/$hooks/badName/index.tsx': '',
    })
    expect(messages(check(root))).toContain(
      'Hook directory "badName" must match use[A-Z]… (e.g. useAttachments)',
    )
  })
})
