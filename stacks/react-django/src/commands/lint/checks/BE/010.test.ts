import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './010'

const MODELS = 'backend/apps/core/models.py'

describe('BE010 — no null=True on text fields', () => {
  it('passes blank=True with default', () => {
    const root = makeProject({
      [MODELS]: 'name = models.CharField(max_length=10, blank=True, default="")\n',
    })
    expect(check(root)).toEqual([])
  })

  it('warns on CharField(null=True)', () => {
    const root = makeProject({
      [MODELS]: 'name = models.CharField(max_length=10, null=True)\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
  })

  it('warns on TextField(null=True) and allows null on other field types', () => {
    const root = makeProject({
      [MODELS]: [
        'body = models.TextField(null=True)',
        'count = models.IntegerField(null=True)',
        '',
      ].join('\n'),
    })
    expect(check(root)).toHaveLength(1)
  })
})
