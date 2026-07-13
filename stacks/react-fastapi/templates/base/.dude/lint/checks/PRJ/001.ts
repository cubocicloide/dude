/**
 * Example project lint check — PRJ001.
 *
 * This file is a starting point: rename it, edit it, or delete it. Every
 * module under `.dude/lint/checks/<GROUP>/<id>.ts` becomes a lint rule coded
 * `<GROUP><id>` (this one is `PRJ001`) and runs on every `dude lint`, right
 * after the stack's built-in checks. See `.dude/lint/checks/README.md` for
 * the full contract.
 */
import type { RawDiagnostic } from '@cubocicloide/dude'

export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  // Emit a diagnostic for each violation you find under `root`, e.g.:
  //
  // diagnostics.push({
  //   file: 'backend/app/main.py', // path relative to the project root
  //   line: 1,
  //   col: 1,
  //   severity: 'error',           // 'error' fails `dude lint`; 'warning' doesn't
  //   message: 'What is wrong and how to fix it.',
  // })

  return diagnostics
}
