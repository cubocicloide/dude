import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Frappe's scrub(): lowercase, spaces → underscores. */
function scrub(name: string): string {
  return name.toLowerCase().replace(/ /g, '_')
}

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

/**
 * Extract a top-level `fixtures = [...]` block via bracket balancing
 * (the file is tab-indented — no whitespace assumptions).
 */
function extractFixturesBlock(lines: string[]): Array<{ text: string; line: number }> | null {
  const start = lines.findIndex((l) => /^\s*fixtures\s*=\s*\[/.test(l))
  if (start === -1) return null

  const block: Array<{ text: string; line: number }> = []
  let depth = 0
  for (let i = start; i < lines.length; i++) {
    const text = lines[i]!
    block.push({ text, line: i + 1 })
    for (const ch of text) {
      if (ch === '[') depth++
      else if (ch === ']') depth--
    }
    if (depth <= 0) break
  }
  return block
}

/**
 * Collect the DocTypes declared in the fixtures block.
 * Handles both dict entries ({"dt": "Workflow", ...}) and plain string
 * entries ("Workflow"): a quoted string sitting directly in the list
 * (square depth 1, curly depth 0) is a plain fixture name.
 */
function declaredFixtures(block: Array<{ text: string; line: number }>): Map<string, { dt: string; line: number }> {
  const declared = new Map<string, { dt: string; line: number }>()
  const add = (dt: string, line: number) => {
    if (!declared.has(scrub(dt))) declared.set(scrub(dt), { dt, line })
  }

  let square = 0
  let curly = 0
  let quote: string | null = null
  let current = ''
  for (const { text, line } of block) {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!
      if (quote) {
        if (ch === '\\') {
          current += ch + (text[i + 1] ?? '')
          i++
        } else if (ch === quote) {
          if (square === 1 && curly === 0) add(current, line) // plain string entry
          quote = null
        } else {
          current += ch
        }
        continue
      }
      if (ch === '#') break // python comment — ignore rest of line
      if (ch === '"' || ch === "'") {
        quote = ch
        current = ''
      } else if (ch === '[') square++
      else if (ch === ']') square--
      else if (ch === '{') curly++
      else if (ch === '}') curly--
    }
    // dict entries: {"dt": "Workflow State", ...}
    for (const m of text.matchAll(/["']dt["']\s*:\s*["']([^"']+)["']/g)) {
      add(m[1]!, line)
    }
  }
  return declared
}

/**
 * APP004 — Fixtures parity.
 *
 * Every DocType declared in hooks.py `fixtures` must have its exported
 * apps/<app>/<app>/fixtures/<scrub(dt)>.json on disk, and every JSON file in
 * the fixtures directory must be declared in hooks.py.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const app of listApps(root)) {
    const hooksRel = `apps/${app}/${app}/hooks.py`
    const fixturesDir = path.join(root, 'apps', app, app, 'fixtures')

    let hooks = ''
    try {
      hooks = readFileSync(path.join(root, hooksRel), 'utf8')
    } catch {
      continue // APP001 reports the missing hooks.py
    }

    const block = extractFixturesBlock(hooks.split('\n'))

    let jsonFiles: string[] = []
    try {
      jsonFiles = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'))
    } catch {
      // no fixtures directory
    }

    if (!block && jsonFiles.length === 0) continue

    const declared = block ? declaredFixtures(block) : new Map<string, { dt: string; line: number }>()

    // declared in hooks.py → file must exist
    for (const [scrubbed, { dt, line }] of declared) {
      if (!jsonFiles.includes(`${scrubbed}.json`)) {
        diagnostics.push({
          file: hooksRel,
          line,
          col: 1,
          severity: 'error',
          message: `Fixture "${dt}" is declared in hooks.py but apps/${app}/${app}/fixtures/${scrubbed}.json does not exist — run \`bench export-fixtures\` (or remove the declaration)`,
        })
      }
    }

    // file on disk → must be declared in hooks.py
    for (const file of jsonFiles) {
      if (!declared.has(file.replace(/\.json$/, ''))) {
        diagnostics.push({
          file: `apps/${app}/${app}/fixtures/${file}`,
          line: 1,
          col: 1,
          severity: 'error',
          message: `fixtures/${file} is not declared in the \`fixtures\` list of hooks.py — undeclared fixture files are never imported by \`bench migrate\``,
        })
      }
    }
  }

  return diagnostics
}
