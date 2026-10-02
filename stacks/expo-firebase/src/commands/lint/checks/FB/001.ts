import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf, readText, relative } from '../../helpers.js'

/** FB001 — Firebase app initialization has one owner. */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  const sourceFiles = [
    ...collectFiles(path.join(root, 'app'), (name) => /\.tsx?$/.test(name)),
    ...collectFiles(path.join(root, 'src'), (name) => /\.tsx?$/.test(name)),
  ]
  for (const file of sourceFiles) {
    if (file.endsWith(path.join('src', 'lib', 'firebase', 'app.ts'))) continue
    const content = readText(file)
    const index = content.indexOf('initializeApp(')
    if (index !== -1)
      diagnostics.push({
        file: relative(root, file),
        line: lineOf(content, index),
        col: 1,
        severity: 'error',
        message: 'initializeApp() may only appear in src/lib/firebase/app.ts',
      })
  }
  return diagnostics
}
