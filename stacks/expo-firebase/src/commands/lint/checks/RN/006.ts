import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf, readText, relative } from '../../helpers.js'

/** RN006 — shared modules cannot use browser-only globals. */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const file of collectFiles(
    path.join(root, 'src'),
    (name) => /\.tsx?$/.test(name) && !/\.web\.tsx?$/.test(name),
  )) {
    const content = readText(file)
    const match = /\b(window|document|localStorage)\b/.exec(content)
    if (match)
      diagnostics.push({
        file: relative(root, file),
        line: lineOf(content, match.index),
        col: 1,
        severity: 'error',
        message: `Browser-only global "${match[1]}" belongs in a .web.ts(x) module`,
      })
  }
  return diagnostics
}
