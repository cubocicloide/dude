import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Groups that must have 1-to-1 source ↔ test file coverage. */
const GROUPS = ['models', 'queries', 'routers', 'utils'] as const

/**
 * BE008 — every source file in models/queries/routers/utils must have a
 * corresponding test file in tests/{group}/test_{stem}.py, and vice-versa.
 *
 * Warning: source file exists but test is missing → add the test.
 * Error:   test file exists but source is missing → orphaned test.
 */
export default function check(root: string): RawDiagnostic[] {
  const appDir = path.join(root, 'backend', 'app')
  const testsDir = path.join(appDir, 'tests')
  if (!existsSync(appDir) || !existsSync(testsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const group of GROUPS) {
    const srcDir = path.join(appDir, group)
    const testDir = path.join(testsDir, group)

    // Collect source stems (exclude __init__.py)
    const srcStems = new Set<string>()
    if (existsSync(srcDir)) {
      for (const e of readdirSync(srcDir, { withFileTypes: true })) {
        if (e.isFile() && e.name.endsWith('.py') && e.name !== '__init__.py') {
          srcStems.add(e.name.slice(0, -3))
        }
      }
    }

    // Collect test stems from test_*.py files (exclude __init__.py)
    const testStems = new Set<string>()
    if (existsSync(testDir)) {
      for (const e of readdirSync(testDir, { withFileTypes: true })) {
        if (e.isFile() && e.name.startsWith('test_') && e.name.endsWith('.py')) {
          testStems.add(e.name.slice('test_'.length, -3))
        }
      }
    }

    // Warning: source exists, test missing
    for (const stem of srcStems) {
      if (!testStems.has(stem)) {
        diagnostics.push({
          file: path.join('backend', 'app', group, `${stem}.py`),
          line: 1, col: 1, severity: 'warning',
          message: `tests/${group}/test_${stem}.py is missing — no tests for \`${group}/${stem}.py\``,
        })
      }
    }

    // Error: test exists, source missing
    for (const stem of testStems) {
      if (!srcStems.has(stem)) {
        diagnostics.push({
          file: path.join('backend', 'app', 'tests', group, `test_${stem}.py`),
          line: 1, col: 1, severity: 'error',
          message: `\`test_${stem}.py\` has no corresponding \`${group}/${stem}.py\` — remove this test or create the source file`,
        })
      }
    }
  }

  return diagnostics
}
