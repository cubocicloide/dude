import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

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
 * Extract a top-level `<name> = {...}` block from hooks.py via brace
 * balancing (the file is tab-indented — no whitespace assumptions).
 * Returns the block's lines with their 1-based line numbers.
 */
function extractBraceBlock(
  lines: string[],
  name: string,
): Array<{ text: string; line: number }> | null {
  const re = new RegExp(`^\\s*${name}\\s*=\\s*\\{`)
  const start = lines.findIndex((l) => re.test(l))
  if (start === -1) return null

  const block: Array<{ text: string; line: number }> = []
  let depth = 0
  for (let i = start; i < lines.length; i++) {
    const text = lines[i]!
    block.push({ text, line: i + 1 })
    for (const ch of text) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
    if (depth <= 0) break
  }
  return block
}

/** A dotted path is a handler when it starts with "<app>." and looks like a.b.func. */
const HANDLER_RE = /^[a-z_][\w.]*\.\w+$/

/**
 * Verify every "<app>.a.b.func" string inside the given hooks.py block
 * resolves to a real `def func(` (or `async def`) on disk.
 */
function checkDottedHandlers(root: string, app: string, blockName: string): RawDiagnostic[] {
  const hooksRel = `apps/${app}/${app}/hooks.py`
  let content: string
  try {
    content = readFileSync(path.join(root, hooksRel), 'utf8')
  } catch {
    return []
  }

  const block = extractBraceBlock(content.split('\n'), blockName)
  if (!block) return []

  const diagnostics: RawDiagnostic[] = []
  for (const { text, line } of block) {
    for (const m of text.matchAll(/["']([^"']+)["']/g)) {
      const dotted = m[1]!
      if (!HANDLER_RE.test(dotted) || !dotted.startsWith(`${app}.`)) continue

      const segments = dotted.split('.')
      const func = segments[segments.length - 1]!
      const modRel = segments.slice(0, -1).join('/')
      const col = (m.index ?? 0) + 1

      const candidates = [
        `apps/${app}/${modRel}.py`,
        `apps/${app}/${modRel}/__init__.py`,
      ].filter((rel) => existsSync(path.join(root, rel)))

      if (candidates.length === 0) {
        diagnostics.push({
          file: hooksRel,
          line,
          col,
          severity: 'error',
          message: `${blockName} handler "${dotted}" does not resolve: apps/${app}/${modRel}.py not found`,
        })
        continue
      }

      const defRe = new RegExp(`^[ \\t]*(?:async[ \\t]+)?def[ \\t]+${func}[ \\t]*\\(`, 'm')
      const defined = candidates.some((rel) => {
        try {
          return defRe.test(readFileSync(path.join(root, rel), 'utf8'))
        } catch {
          return false
        }
      })
      if (!defined) {
        diagnostics.push({
          file: hooksRel,
          line,
          col,
          severity: 'error',
          message: `${blockName} handler "${dotted}" does not resolve: no "def ${func}(" in ${candidates.join(' or ')}`,
        })
      }
    }
  }
  return diagnostics
}

/**
 * APP003 — doc_events handlers resolve.
 *
 * Document-event handlers are resolved by dotted path at runtime: a typo does
 * not fail at install time, the hook silently never fires. Verify every
 * handler declared in hooks.py doc_events exists on disk.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const app of listApps(root)) {
    diagnostics.push(...checkDottedHandlers(root, app, 'doc_events'))
  }
  return diagnostics
}
