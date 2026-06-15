import { describe, it, expect } from 'vitest'
import { makeProject, messages, type Tree } from '../../../_testkit'
import check from './001'

const REQUIRED_DIRS = [
  'core',
  'fixtures',
  'management',
  'models',
  'queries',
  'routers',
  'schemas',
  'tasks',
  'tests',
  'utils',
]

/** A fully-valid backend/app tree (no diagnostics expected). */
function validApp(): Tree {
  const tree: Tree = {
    'backend/app/main.py': '',
    'backend/app/__init__.py': '',
    'backend/app/tests/__init__.py': '',
    'backend/app/tests/conftest.py': '',
  }
  for (const dir of REQUIRED_DIRS) tree[`backend/app/${dir}/.keep`] = ''
  for (const dir of ['models', 'queries', 'routers', 'tasks', 'utils']) {
    tree[`backend/app/tests/${dir}/__init__.py`] = ''
  }
  return tree
}

describe('BE001 — backend/app structure', () => {
  it('reports a single error when backend/app/ is missing entirely', () => {
    const root = makeProject({ 'frontend/src/.keep': '' })
    const diags = check(root)
    expect(diags).toHaveLength(1)
    expect(diags[0]!.message).toBe('backend/app/ directory is missing')
    expect(diags[0]!.severity).toBe('error')
  })

  it('passes for a fully-formed backend/app/', () => {
    const root = makeProject(validApp())
    expect(check(root)).toEqual([])
  })

  it('flags a missing required directory', () => {
    const tree = validApp()
    delete tree['backend/app/queries/.keep']
    const root = makeProject(tree)
    expect(messages(check(root))).toContain('backend/app/queries/ is missing')
  })

  it('flags a missing required file', () => {
    const tree = validApp()
    delete tree['backend/app/main.py']
    const root = makeProject(tree)
    expect(messages(check(root))).toContain('backend/app/main.py is missing')
  })

  it('flags a missing tests/ subdir and missing tests/ files', () => {
    const tree = validApp()
    delete tree['backend/app/tests/queries/__init__.py']
    delete tree['backend/app/tests/conftest.py']
    const root = makeProject(tree)
    const msgs = messages(check(root))
    expect(msgs).toContain('backend/app/tests/queries/ is missing')
    expect(msgs).toContain('backend/app/tests/conftest.py is missing')
  })

  it('flags a tests/ subdir that exists but lacks __init__.py', () => {
    const tree = validApp()
    delete tree['backend/app/tests/models/__init__.py']
    tree['backend/app/tests/models/.keep'] = ''
    const root = makeProject(tree)
    expect(messages(check(root))).toContain('backend/app/tests/models/__init__.py is missing')
  })
})
