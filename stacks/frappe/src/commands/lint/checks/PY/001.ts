import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const GUEST_RE = /allow_guest\s*=\s*True/
const JUSTIFICATION_RE = /#\s*guest-ok:/

/** Apps under apps/ that have a pyproject.toml (valid bench apps). */
function listApps(root: string): string[] {
  const appsDir = path.join(root, 'apps')
  try {
    return readdirSync(appsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(appsDir, e.name, 'pyproject.toml')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/** All .py files under a directory, recursively. */
function walkPy(dir: string, out: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!e.name.startsWith('.')) walkPy(path.join(dir, e.name), out)
    } else if (e.name.endsWith('.py')) {
      out.push(path.join(dir, e.name))
    }
  }
  return out
}

/**
 * PY001 — No unjustified guest APIs.
 *
 * `allow_guest=True` inside a @frappe.whitelist(...) decorator is an error
 * unless justified with a `# guest-ok: <reason>` comment on the same line or
 * the line directly above.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const app of listApps(root)) {
    const pkg = path.join(root, 'apps', app, app)
    for (const file of walkPy(pkg)) {
      const rel = `apps/${app}/${app}/${path.relative(pkg, file)}`
      let src: string
      try {
        src = readFileSync(file, 'utf8')
      } catch {
        continue
      }

      const lines = src.split('\n')
      let inDecorator = false
      let parenDepth = 0

      const flag = (i: number) => {
        const line = lines[i]!
        const m = line.match(GUEST_RE)
        if (!m) return
        const justified =
          JUSTIFICATION_RE.test(line) || (i > 0 && JUSTIFICATION_RE.test(lines[i - 1]!))
        if (justified) return
        diagnostics.push({
          file: rel,
          line: i + 1,
          col: (m.index ?? 0) + 1,
          severity: 'error',
          message:
            'allow_guest=True exposes this whitelisted method to unauthenticated callers (it bypasses login entirely). Remove it, or justify it with a "# guest-ok: <reason>" comment on the same line or the line above.',
        })
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (!inDecorator) {
          const m = line.match(/@frappe\.whitelist\s*\(/)
          if (!m) continue
          inDecorator = true
          parenDepth = 0
          for (const ch of line.slice(m.index!)) {
            if (ch === '(') parenDepth++
            else if (ch === ')') parenDepth--
          }
          flag(i)
        } else {
          for (const ch of line) {
            if (ch === '(') parenDepth++
            else if (ch === ')') parenDepth--
          }
          flag(i)
        }
        if (parenDepth <= 0) inDecorator = false
      }
    }
  }

  return diagnostics
}
