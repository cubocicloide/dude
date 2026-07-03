import { describe, it, expect } from 'vitest'
import { makeProject } from '../../../_testkit'
import check from './013'

const VIEWS = 'backend/apps/core/views.py'

describe('BE013 — typed OpenAPI schema', () => {
  it('passes a view with serializer_class', () => {
    const root = makeProject({
      [VIEWS]: [
        'class UserViewSet(ReadOnlyModelViewSet):',
        '    serializer_class = UserSerializer',
        '',
      ].join('\n'),
    })
    expect(check(root)).toEqual([])
  })

  it('passes a view decorated with @extend_schema (class or method)', () => {
    const root = makeProject({
      [VIEWS]: [
        '@extend_schema(tags=["health"])',
        'class HealthView(APIView):',
        '    def get(self, request):',
        '        pass',
        '',
        'class OtherView(APIView):',
        '    @extend_schema(responses=None)',
        '    def get(self, request):',
        '        pass',
        '',
      ].join('\n'),
    })
    expect(check(root)).toEqual([])
  })

  it('warns on a view with neither serializer_class nor @extend_schema', () => {
    const root = makeProject({
      [VIEWS]: ['class BareView(APIView):', '    def get(self, request):', '        pass', ''].join(
        '\n',
      ),
    })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('warning')
  })
})
