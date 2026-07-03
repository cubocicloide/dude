import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'pathe'
import { makeTempDir } from '../_testkit'
import { Baseline } from './baseline'
import { Severity, fingerprint, type Finding } from './models'

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

describe('Baseline.load', () => {
  it('returns an empty baseline when the file is missing', () => {
    const b = Baseline.load(path.join(makeTempDir(), 'nope.json'))
    expect(b.entries.size).toBe(0)
  })

  it('reads entries with snake_case field mapping', () => {
    const dir = makeTempDir()
    const file = path.join(dir, 'baseline.json')
    const b = new Baseline()
    b.updateFrom([finding()])
    b.save(file)

    const reloaded = Baseline.load(file)
    expect(reloaded.entries.size).toBe(1)
    const entry = [...reloaded.entries.values()][0]!
    expect(entry).toMatchObject({
      tool: 'bandit',
      ruleId: 'B101',
      severity: 'HIGH',
      file: 'backend/app/main.py',
      title: 'Use of assert',
    })
    expect(entry.firstSeen).not.toBe('')
  })
})

describe('Baseline.save', () => {
  it('writes sorted, snake_case JSON with a trailing newline', () => {
    const dir = makeTempDir()
    const file = path.join(dir, 'nested', 'baseline.json') // dir auto-created
    const b = new Baseline()
    b.updateFrom([finding(), finding({ ruleId: 'B102', title: 'Another' })])
    b.save(file)

    const raw = readFileSync(file, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    const data = JSON.parse(raw)
    expect(data).toHaveProperty('generated_at')
    const keys = Object.keys(data.entries)
    expect([...keys]).toEqual([...keys].sort())
    const first = data.entries[keys[0]!]
    expect(first).toHaveProperty('rule_id')
    expect(first).toHaveProperty('first_seen')
  })
})

describe('Baseline.updateFrom', () => {
  it('adds new findings and never overwrites an existing entry', () => {
    const b = new Baseline()
    b.updateFrom([finding()])
    const firstSeen = [...b.entries.values()][0]!.firstSeen

    // Re-adding the same fingerprint (different line) must not change firstSeen
    b.updateFrom([finding({ line: 99 })])
    expect(b.entries.size).toBe(1)
    expect([...b.entries.values()][0]!.firstSeen).toBe(firstSeen)
  })
})

describe('Baseline.classify', () => {
  it('splits findings into new vs known and lists resolved fingerprints', () => {
    const known = finding()
    const b = new Baseline()
    b.updateFrom([known])

    const fresh = finding({ ruleId: 'B201', title: 'New issue' })
    const { newFindings, knownFindings, resolved } = b.classify([known, fresh])

    expect(knownFindings).toEqual([known])
    expect(newFindings).toEqual([fresh])
    expect(resolved).toEqual([])
  })

  it('reports a baseline entry no longer present as resolved', () => {
    const gone = finding()
    const b = new Baseline()
    b.updateFrom([gone])

    const { newFindings, knownFindings, resolved } = b.classify([])
    expect(newFindings).toEqual([])
    expect(knownFindings).toEqual([])
    expect(resolved).toEqual([fingerprint(gone)])
  })
})
