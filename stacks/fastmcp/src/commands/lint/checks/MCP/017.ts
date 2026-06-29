import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { appDir, appRel, featureNames, isDir, listPyModules } from '../../_ast.js'

/** Per-feature packages that require 1-to-1 test coverage. */
const FEATURE_PKGS = ['tools', 'resources', 'prompts', 'utils']

/**
 * MCP017 — 1-to-1 test coverage (mirrors react-fastapi BE008).
 *
 * Every operational module has a matching test under the mirrored `tests/` path,
 * and vice-versa:
 *   features/<f>/<pkg>/<x>.py  ↔  tests/features/<f>/<pkg>/test_<x>.py
 *   utils/<x>.py (global)      ↔  tests/utils/test_<x>.py
 *
 * Warning: source exists but test missing. Error: orphaned test (no source).
 */
export default function check(root: string): RawDiagnostic[] {
  const app = appDir(root)
  if (!isDir(app)) return []

  const diagnostics: RawDiagnostic[] = []

  // Pairs of (source dir rel, test dir rel) to compare.
  const pairs: { src: string; test: string }[] = [
    { src: path.join('utils'), test: path.join('tests', 'utils') },
  ]
  for (const feature of featureNames(root)) {
    for (const pkg of FEATURE_PKGS) {
      pairs.push({
        src: path.join('features', feature, pkg),
        test: path.join('tests', 'features', feature, pkg),
      })
    }
  }

  for (const { src, test } of pairs) {
    const srcStems = new Set(listPyModules(path.join(app, src)))
    const testStems = new Set(
      listPyModules(path.join(app, test))
        .filter((s) => s.startsWith('test_'))
        .map((s) => s.slice('test_'.length)),
    )

    // Source present, test missing → warning.
    for (const stem of srcStems) {
      if (!testStems.has(stem)) {
        diagnostics.push({
          file: appRel(src, `${stem}.py`),
          line: 1,
          col: 1,
          severity: 'warning',
          message: `missing test — expected ${appRel(test, `test_${stem}.py`)}`,
        })
      }
    }

    // Test present, source missing → error (orphan).
    for (const stem of testStems) {
      // Only flag orphans when the source dir is a real package (avoid noise for
      // packages a feature legitimately doesn't have).
      if (!srcStems.has(stem)) {
        diagnostics.push({
          file: appRel(test, `test_${stem}.py`),
          line: 1,
          col: 1,
          severity: 'error',
          message: `orphaned test — no matching ${appRel(src, `${stem}.py`)}`,
        })
      }
    }
  }

  return diagnostics
}
