import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf, readText, relative } from '../../helpers.js'

/** FB002 — Firestore calls live behind feature repositories or Firebase adapters. */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const file of collectFiles(path.join(root, 'src'), (name) => /\.tsx?$/.test(name))) {
    const rel = relative(root, file).replace(/\\/g, '/')
    if (rel.startsWith('src/lib/firebase/') || /\/repository\.ts$/.test(rel)) continue
    const content = readText(file)
    const match = /from\s+['"]firebase\/firestore['"]/.exec(content)
    if (match)
      diagnostics.push({
        file: relative(root, file),
        line: lineOf(content, match.index),
        col: 1,
        severity: 'error',
        message: 'Import Firestore only from Firebase adapters or feature repository.ts modules',
      })
  }
  return diagnostics
}
