import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf, readText, relative } from '../../helpers.js'

/** FB003 — emulator connections are centralized and environment-gated. */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const file of collectFiles(path.join(root, 'src'), (name) => /\.tsx?$/.test(name))) {
    if (file.endsWith(path.join('src', 'lib', 'firebase', 'emulators.ts'))) continue
    const content = readText(file)
    const match = /connect(?:Auth|Firestore)Emulator\s*\(/.exec(content)
    if (match)
      diagnostics.push({
        file: relative(root, file),
        line: lineOf(content, match.index),
        col: 1,
        severity: 'error',
        message: 'Connect emulators only in src/lib/firebase/emulators.ts',
      })
  }
  return diagnostics
}
