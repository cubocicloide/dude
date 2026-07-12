import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const SQL_CALL = 'frappe.db.sql('

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

/** Remove string-literal contents and trailing comment from a code fragment. */
function stripStringsAndComment(fragment: string): string {
  const noStrings = fragment.replace(/(['"])(?:\\.|(?!\1).)*?\1/g, "''")
  const hash = noStrings.indexOf('#')
  return hash === -1 ? noStrings : noStrings.slice(0, hash)
}

/**
 * PY002 — SQL safety.
 *
 * frappe.db.sql() with a dynamically-built query (f-string, %, .format, +) is
 * an error (SQL injection). Any other raw frappe.db.sql() call is a warning:
 * prefer frappe.get_all / frappe.qb.
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
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const idx = line.indexOf(SQL_CALL)
        if (idx === -1) continue

        const call = line.slice(idx + SQL_CALL.length)
        const firstArgIsFString = /^\s*(?:rf|fr|f)["']/i.test(call)
        const stripped = stripStringsAndComment(call)
        const concatenates =
          stripped.includes('%') || stripped.includes('.format(') || stripped.includes('+')

        if (firstArgIsFString || concatenates) {
          diagnostics.push({
            file: rel,
            line: i + 1,
            col: idx + 1,
            severity: 'error',
            message:
              'frappe.db.sql() with a dynamically-built query (f-string / % / .format / +) is a SQL injection risk — use parameterized queries: frappe.db.sql(query, values) with %(name)s placeholders.',
          })
        } else {
          diagnostics.push({
            file: rel,
            line: i + 1,
            col: idx + 1,
            severity: 'warning',
            message:
              'Raw frappe.db.sql() — prefer frappe.get_all / frappe.get_list or frappe.qb (the query builder), which respect permissions and stay portable. Keep raw SQL for what the ORM genuinely cannot express.',
          })
        }
      }
    }
  }

  return diagnostics
}
