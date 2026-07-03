import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './009'

const MODELS = 'backend/apps/core/models.py'

const GOOD_MODEL = [
  'from django.db import models',
  '',
  'class Thing(models.Model):',
  '    name = models.CharField(max_length=10)',
  '',
  '    class Meta:',
  '        ordering = ("id",)',
  '',
  '    def __str__(self) -> str:',
  '        return self.name',
  '',
].join('\n')

describe('BE009 — model __str__ + Meta.ordering', () => {
  it('passes a model with __str__ and ordering', () => {
    expect(check(makeProject({ [MODELS]: GOOD_MODEL }))).toEqual([])
  })

  it('warns when __str__ is missing', () => {
    const root = makeProject({
      [MODELS]: [
        'from django.db import models',
        '',
        'class Thing(models.Model):',
        '    class Meta:',
        '        ordering = ("id",)',
        '',
      ].join('\n'),
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
    expect(diags[0]!.message).toContain('__str__')
  })

  it('warns when Meta.ordering is missing', () => {
    const root = makeProject({
      [MODELS]: [
        'from django.db import models',
        '',
        'class Thing(models.Model):',
        '    def __str__(self) -> str:',
        '        return "x"',
        '',
      ].join('\n'),
    })
    expect(messages(check(root)).join()).toContain('ordering')
  })
})
