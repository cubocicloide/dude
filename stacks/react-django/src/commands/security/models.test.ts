import { describe, it, expect } from 'vitest'
import {
  Severity,
  SEV_LABEL,
  parseSeverity,
  fingerprint,
  findingToRecord,
  type Finding,
} from './models'

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    tool: 'bandit',
    ruleId: 'B101',
    severity: Severity.HIGH,
    title: 'Use of assert',
    message: 'assert detected',
    file: 'backend/app/main.py',
    line: 12,
    component: 'backend',
    extra: {},
    ...overrides,
  }
}

describe('parseSeverity', () => {
  it.each([
    ['CRITICAL', Severity.CRITICAL],
    ['high', Severity.HIGH],
    ['  Medium ', Severity.MEDIUM],
    ['LOW', Severity.LOW],
    ['INFO', Severity.INFO],
  ])('maps canonical name %s', (input, expected) => {
    expect(parseSeverity(input)).toBe(expected)
  })

  it.each([
    ['NOTE', Severity.INFO],
    ['WARNING', Severity.MEDIUM],
    ['MODERATE', Severity.MEDIUM],
    ['ERROR', Severity.HIGH],
    ['SEVERE', Severity.HIGH],
  ])('maps alias %s', (input, expected) => {
    expect(parseSeverity(input)).toBe(expected)
  })

  it('returns UNKNOWN for undefined or unrecognised values', () => {
    expect(parseSeverity(undefined)).toBe(Severity.UNKNOWN)
    expect(parseSeverity('')).toBe(Severity.UNKNOWN)
    expect(parseSeverity('bogus')).toBe(Severity.UNKNOWN)
  })
})

describe('fingerprint', () => {
  it('is a stable 16-char hex digest', () => {
    const fp = fingerprint(finding())
    expect(fp).toMatch(/^[0-9a-f]{16}$/)
    expect(fingerprint(finding())).toBe(fp)
  })

  it('ignores line number (refactors shift lines)', () => {
    expect(fingerprint(finding({ line: 1 }))).toBe(fingerprint(finding({ line: 999 })))
  })

  it('ignores title case and surrounding whitespace', () => {
    expect(fingerprint(finding({ title: '  use OF assert  ' }))).toBe(
      fingerprint(finding({ title: 'Use of assert' })),
    )
  })

  it('differs when tool, ruleId, file, or title change', () => {
    const base = fingerprint(finding())
    expect(fingerprint(finding({ tool: 'semgrep' }))).not.toBe(base)
    expect(fingerprint(finding({ ruleId: 'B102' }))).not.toBe(base)
    expect(fingerprint(finding({ file: 'other.py' }))).not.toBe(base)
    expect(fingerprint(finding({ title: 'something else' }))).not.toBe(base)
  })
})

describe('findingToRecord', () => {
  it('serialises with snake_case keys, a label, and a fingerprint', () => {
    const rec = findingToRecord(finding())
    expect(rec).toMatchObject({
      tool: 'bandit',
      rule_id: 'B101',
      severity: SEV_LABEL[Severity.HIGH],
      file: 'backend/app/main.py',
      line: 12,
      component: 'backend',
    })
    expect(rec['severity']).toBe('HIGH')
    expect(rec['fingerprint']).toBe(fingerprint(finding()))
  })
})
