import { describe, expect, it } from 'vitest'
import { satisfiesMinVersion } from './semver.js'

describe('satisfiesMinVersion', () => {
  it('accepts equal versions', () => {
    expect(satisfiesMinVersion('1.2.3', '1.2.3')).toBe(true)
  })

  it('accepts higher versions at every level', () => {
    expect(satisfiesMinVersion('2.0.0', '1.9.9')).toBe(true)
    expect(satisfiesMinVersion('1.3.0', '1.2.9')).toBe(true)
    expect(satisfiesMinVersion('1.2.4', '1.2.3')).toBe(true)
  })

  it('rejects lower versions at every level', () => {
    expect(satisfiesMinVersion('1.9.9', '2.0.0')).toBe(false)
    expect(satisfiesMinVersion('1.2.9', '1.3.0')).toBe(false)
    expect(satisfiesMinVersion('1.2.3', '1.2.4')).toBe(false)
  })

  it('ignores prerelease and range prefixes', () => {
    expect(satisfiesMinVersion('1.2.3-beta.1', '1.2.3')).toBe(true)
    expect(satisfiesMinVersion('^1.2.3', '1.2.0')).toBe(true)
    expect(satisfiesMinVersion('v2.0.0', '1.0.0')).toBe(true)
  })

  it('treats missing segments as zero', () => {
    expect(satisfiesMinVersion('1', '1.0.0')).toBe(true)
    expect(satisfiesMinVersion('1.2', '1.2.0')).toBe(true)
    expect(satisfiesMinVersion('1.0', '1.0.1')).toBe(false)
  })
})
