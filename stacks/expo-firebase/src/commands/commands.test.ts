import { afterEach, describe, expect, it, vi } from 'vitest'
import { checked, checkedLiveProject, mobileBuildArgs, nestedCommand } from './index.js'

afterEach(() => vi.restoreAllMocks())

describe('command argument validation', () => {
  it('accepts declared choices', () => {
    expect(checked('web', new Set(['web']), 'platform')).toBe('web')
  })

  it('rejects undeclared choices', () => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit 1')
    })
    expect(() => checked('desktop', new Set(['web']), 'platform')).toThrow('exit 1')
  })

  it('rejects demo Firebase projects for deployments', () => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit 1')
    })
    expect(() => checkedLiveProject('demo-my-app')).toThrow('exit 1')
  })

  it('constructs an EAS build without starting one', () => {
    expect(mobileBuildArgs('android', 'preview')).toEqual([
      'dlx',
      'eas-cli',
      'build',
      '--platform',
      'android',
      '--profile',
      'preview',
    ])
  })

  it('keeps emulator scripts a single shell argument', () => {
    expect(nestedCommand('pnpm test:rules')).toBe(
      process.platform === 'win32' ? '"pnpm test:rules"' : 'pnpm test:rules',
    )
  })
})
