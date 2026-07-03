import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './002'

const SER = 'backend/apps/core/serializers.py'

describe('BE002 — explicit serializer fields', () => {
  it('passes an explicit fields tuple', () => {
    const root = makeProject({
      [SER]: [
        'class UserSerializer(serializers.ModelSerializer):',
        '    class Meta:',
        '        model = User',
        '        fields = ("id", "username")',
        '',
      ].join('\n'),
    })
    expect(check(root)).toEqual([])
  })

  it('flags fields = "__all__"', () => {
    const root = makeProject({
      [SER]: [
        'class UserSerializer(serializers.ModelSerializer):',
        '    class Meta:',
        '        model = User',
        '        fields = "__all__"',
        '',
      ].join('\n'),
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
  })

  it('flags exclude = (...)', () => {
    const root = makeProject({
      [SER]: [
        'class UserSerializer(serializers.ModelSerializer):',
        '    class Meta:',
        '        model = User',
        '        exclude = ("password",)',
        '',
      ].join('\n'),
    })
    expect(check(root)).toHaveLength(1)
  })

  it('flags a ModelSerializer whose Meta lacks fields entirely', () => {
    const root = makeProject({
      [SER]: [
        'class UserSerializer(serializers.ModelSerializer):',
        '    class Meta:',
        '        model = User',
        '',
      ].join('\n'),
    })
    expect(check(root).length).toBeGreaterThanOrEqual(1)
  })
})
