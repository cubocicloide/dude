import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf, readText, relative } from '../../helpers.js'

/** RN002 — routes stay thin and never import Firebase directly. */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const file of collectFiles(path.join(root, 'app'), (name) => /\.tsx?$/.test(name))) {
    const content = readText(file)
    for (const match of content.matchAll(/from\s+['"]firebase(?:\/[^'"]+)?['"]/g)) {
      diagnostics.push({
        file: relative(root, file),
        line: lineOf(content, match.index ?? 0),
        col: 1,
        severity: 'error',
        message: 'Route modules must use feature APIs instead of importing Firebase directly',
      })
    }
  }
  return diagnostics
}
