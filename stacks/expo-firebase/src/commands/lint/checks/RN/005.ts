import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf, readText, relative } from '../../helpers.js'

/** RN005 — Expo public environment variables are read only by src/config/env.ts. */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const file of collectFiles(path.join(root, 'src'), (name) => /\.tsx?$/.test(name))) {
    if (file.endsWith(path.join('src', 'config', 'env.ts'))) continue
    const content = readText(file)
    for (const match of content.matchAll(/process\.env\.EXPO_PUBLIC_[A-Z0-9_]+/g)) {
      diagnostics.push({
        file: relative(root, file),
        line: lineOf(content, match.index ?? 0),
        col: 1,
        severity: 'error',
        message: 'Read EXPO_PUBLIC_* values only through src/config/env.ts',
      })
    }
  }
  return diagnostics
}
