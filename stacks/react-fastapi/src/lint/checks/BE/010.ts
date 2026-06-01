import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, _sep, c: string) => c.toUpperCase())
}

/**
 * BE010 — every file in `models/` must define exactly one class, and that
 * class must be named after the file.
 *
 *   models/group.py       → exactly one class named `Group`
 *   models/user_profile.py → exactly one class named `UserProfile`
 */
export default function check(root: string): RawDiagnostic[] {
  const modelsDir = path.join(root, 'backend', 'app', 'models')
  if (!existsSync(modelsDir)) return []

  const diagnostics: RawDiagnostic[] = []
  const classRe = /^class\s+(\w+)/gm

  for (const entry of readdirSync(modelsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue

    const stem = entry.name.replace(/\.py$/, '')
    const expectedName = snakeToPascal(stem)
    const relPath = path.join('backend', 'app', 'models', entry.name)
    const content = readFileSync(path.join(modelsDir, entry.name), 'utf8')

    const classes = [...content.matchAll(classRe)].map((m) => m[1]!)

    if (classes.length === 0) {
      diagnostics.push({
        file: relPath,
        line: 1,
        col: 1,
        severity: 'error',
        message: `models/${entry.name} defines no class — expected exactly one class named \`${expectedName}\``,
      })
      continue
    }

    if (classes.length > 1) {
      diagnostics.push({
        file: relPath,
        line: 1,
        col: 1,
        severity: 'error',
        message: `models/${entry.name} defines ${classes.length} classes (${classes.join(', ')}) — each model file must contain exactly one class named \`${expectedName}\``,
      })
      continue
    }

    if (classes[0] !== expectedName) {
      diagnostics.push({
        file: relPath,
        line: 1,
        col: 1,
        severity: 'error',
        message: `class \`${classes[0]}\` in models/${entry.name} must be named \`${expectedName}\` to match the file name`,
      })
    }
  }

  return diagnostics
}
