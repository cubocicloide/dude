/**
 * CLI integration test: `dude lint` (react-django stack)
 *
 * Tests CLI-level behaviour: exit codes, flag handling, output shape.
 * Does NOT enumerate specific rule codes — those live in
 * src/commands/lint/checks/**\/*.test.ts (unit tests).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from '@cubocicloide/dude/testing'

let project: Project

// A views.py that keeps every error-severity rule green but trips the
// BE012 warning (print instead of logging).
const WARNING_VIEWS = [
  'from drf_spectacular.utils import extend_schema',
  'from rest_framework.permissions import AllowAny',
  'from rest_framework.response import Response',
  'from rest_framework.views import APIView',
  '',
  '',
  '@extend_schema(responses=None)',
  'class NoisyView(APIView):',
  '    permission_classes = [AllowAny]',
  '',
  '    def get(self, request):',
  '        print("debug")',
  '        return Response({"ok": True})',
  '',
].join('\n')

describe('dude lint', () => {
  beforeAll(() => {
    project = Project.scaffold({ stack: './stacks/react-django', prefix: 'dude-lint-' })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('exits 0 on a clean scaffold', () => {
    const r = project.run('lint')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('No issues found.')
  })

  it('exits 1 when there is a lint error', () => {
    // Removing an app's tests/ package violates BE014 (error severity).
    project.remove('backend/apps/core/tests')
    const r = project.run('lint')
    expect(r.status).toBe(1)
    expect(r.stdout + r.stderr).toMatch(/error/)
    project.restore('backend/apps/core/tests')
  })

  it('exits 0 after the error is fixed', () => {
    expect(project.run('lint').status).toBe(0)
  })

  it('exits 0 (not 1) when there are only warnings', () => {
    project.write('backend/apps/core/views_noisy.py', WARNING_VIEWS)
    // views_noisy.py is not a views.py, so only BE012 (print) fires — a warning.
    const r = project.run('lint')
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).toMatch(/warning/)
    project.restore('backend/apps/core/views_noisy.py')
  })

  it('--quiet suppresses warnings and still exits 0', () => {
    project.write('backend/apps/core/views_noisy.py', WARNING_VIEWS)
    const r = project.run('lint', '--quiet')
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).not.toMatch(/[A-Z]{2}\d{3}/)
    project.restore('backend/apps/core/views_noisy.py')
  })
})
