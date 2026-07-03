import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './011'

const MODELS = 'backend/apps/core/models.py'

describe('BE011 — explicit related_name on relations', () => {
  it('passes relations with related_name', () => {
    const root = makeProject({
      [MODELS]: [
        'owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="things")',
        'tags = models.ManyToManyField(',
        '    Tag,',
        '    related_name="things",',
        ')',
        '',
      ].join('\n'),
    })
    expect(check(root)).toEqual([])
  })

  it('warns on ForeignKey without related_name', () => {
    const root = makeProject({
      [MODELS]: 'owner = models.ForeignKey(User, on_delete=models.CASCADE)\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
    expect(diags[0]!.message).toContain('related_name')
  })

  it('warns on a multi-line OneToOneField without related_name', () => {
    const root = makeProject({
      [MODELS]: [
        'profile = models.OneToOneField(',
        '    Profile,',
        '    on_delete=models.CASCADE,',
        ')',
        '',
      ].join('\n'),
    })
    expect(check(root)).toHaveLength(1)
  })
})
