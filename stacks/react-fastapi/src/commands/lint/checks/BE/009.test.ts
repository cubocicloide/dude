import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './009'

describe('BE009 — env var centralisation', () => {
  it('warns when core/config.py is missing', () => {
    const root = makeProject({ 'backend/app/main.py': '' })
    expect(messages(check(root))).toContain(
      'backend/app/core/config.py is missing — create a Pydantic BaseSettings class to centralise env vars',
    )
  })

  it('errors on os.getenv used outside core/', () => {
    const root = makeProject({
      'backend/app/core/config.py': 'class Settings(BaseSettings):\n    A: str\n',
      'backend/app/utils/helpers.py': 'import os\nx = os.getenv("FOO")\n',
    })
    const diags = check(root)
    const envErr = diags.find((d) => d.message.includes('os.getenv'))
    expect(envErr).toBeDefined()
    expect(envErr!.severity).toBe('error')
    expect(envErr!.line).toBe(2)
  })

  it('allows os.getenv inside core/', () => {
    const root = makeProject({
      'backend/app/core/config.py':
        'import os\nclass Settings(BaseSettings):\n    A: str\nx = os.getenv("FOO")\n',
    })
    expect(check(root).filter((d) => d.message.includes('os.getenv'))).toEqual([])
  })

  it('warns when Settings fields are not alphabetical', () => {
    const root = makeProject({
      'backend/app/core/config.py': 'class Settings(BaseSettings):\n    ZEBRA: str\n    APPLE: str\n',
    })
    expect(messages(check(root)).some((m) => m.includes('not in alphabetical order'))).toBe(true)
  })

  it('does not warn when Settings fields are alphabetical', () => {
    const root = makeProject({
      'backend/app/core/config.py': 'class Settings(BaseSettings):\n    APPLE: str\n    ZEBRA: str\n',
    })
    expect(messages(check(root)).some((m) => m.includes('not in alphabetical order'))).toBe(false)
  })
})
