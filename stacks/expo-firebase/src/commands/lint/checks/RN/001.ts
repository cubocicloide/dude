import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const REQUIRED = [
  'app/_layout.tsx',
  'app/(auth)/sign-in.tsx',
  'app/(auth)/sign-up.tsx',
  'app/(app)/index.tsx',
  'src/components',
  'src/features',
  'src/hooks',
  'src/config/env.ts',
  'src/lib/firebase',
]

/** RN001 — the canonical Expo Router and source layout must exist. */
export default function check(root: string): RawDiagnostic[] {
  return REQUIRED.filter((entry) => !existsSync(path.join(root, entry))).map((entry) => ({
    file: entry,
    line: 1,
    col: 1,
    severity: 'error' as const,
    message: `Required Expo stack path is missing: ${entry}`,
  }))
}
