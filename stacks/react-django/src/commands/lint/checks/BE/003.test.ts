import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './003'

const VIEWS = 'backend/apps/core/views.py'

describe('BE003 — explicit permission_classes', () => {
  it('passes a view that declares permission_classes', () => {
    const root = makeProject({
      [VIEWS]: [
        'class HealthView(APIView):',
        '    permission_classes = [AllowAny]',
        '',
      ].join('\n'),
    })
    expect(check(root)).toEqual([])
  })

  it('flags an APIView without permission_classes', () => {
    const root = makeProject({
      [VIEWS]: ['class HealthView(APIView):', '    def get(self, request):', '        pass', ''].join(
        '\n',
      ),
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('permission_classes')
  })

  it('flags a ViewSet without permission_classes', () => {
    const root = makeProject({
      [VIEWS]: ['class UserViewSet(ReadOnlyModelViewSet):', '    queryset = User.objects.all()', ''].join(
        '\n',
      ),
    })
    expect(check(root)).toHaveLength(1)
  })

  it('ignores non-view classes', () => {
    const root = makeProject({
      [VIEWS]: ['class Helper(object):', '    pass', ''].join('\n'),
    })
    expect(check(root)).toEqual([])
  })
})
