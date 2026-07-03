import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './005'

const VIEWS = 'backend/apps/core/views.py'

describe('BE005 — no ORM writes in views', () => {
  it('allows read-only queryset attributes and serializer.save()', () => {
    const root = makeProject({
      [VIEWS]: [
        'class UserViewSet(ReadOnlyModelViewSet):',
        '    queryset = User.objects.all()',
        '    def perform_create(self, serializer):',
        '        serializer.save()',
        '',
      ].join('\n'),
    })
    expect(check(root)).toEqual([])
  })

  it('flags objects.create( in views', () => {
    const root = makeProject({
      [VIEWS]: 'User.objects.create(username="x")\n',
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('services.py')
  })

  it('flags queryset .delete() and .update( chains', () => {
    const root = makeProject({
      [VIEWS]: [
        'User.objects.filter(active=False).delete()',
        'self.get_queryset().update(active=True)',
        '',
      ].join('\n'),
    })
    expect(check(root)).toHaveLength(2)
  })

  it('does not flag writes in services.py', () => {
    const root = makeProject({
      'backend/apps/core/services.py': 'User.objects.create(username="x")\n',
    })
    expect(check(root)).toEqual([])
  })
})
