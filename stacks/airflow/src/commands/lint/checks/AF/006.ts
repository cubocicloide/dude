import type { RawDiagnostic } from '@cubocicloide/dude'
import { dagFiles, parseTimeMask, readLines, stripComment } from '../../_py.js'

const FORBIDDEN = [
  { re: /\bVariable\.get\s*\(/, what: 'Variable.get()' },
  { re: /\bVariable\.get_variable_from_secrets\s*\(/, what: 'Variable.get_variable_from_secrets()' },
  { re: /\bBaseHook\.get_connection\s*\(/, what: 'BaseHook.get_connection()' },
  { re: /\bConnection\.get_connection_from_secrets\s*\(/, what: 'Connection.get_connection_from_secrets()' },
]

/**
 * AF006 — no metadata-DB / secrets access at parse time.
 *
 * The dag-processor re-imports every DAG file continuously; a `Variable.get`
 * at module scope (or inside a `with DAG:` block but outside a task callable)
 * hits the metadata DB / secrets backend on every parse cycle. Resolve
 * variables inside task functions, or template them (`{{ var.value.x }}`).
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  for (const rel of dagFiles(root)) {
    const lines = readLines(root, rel)
    const parseTime = parseTimeMask(lines)
    for (let i = 0; i < lines.length; i++) {
      if (!parseTime[i]) continue
      const line = stripComment(lines[i] ?? '')
      for (const { re, what } of FORBIDDEN) {
        if (re.test(line)) {
          out.push({
            file: rel,
            line: i + 1,
            col: 1,
            severity: 'error',
            message:
              `${what} runs on every DAG parse — move it inside a task function, ` +
              'or use a template like {{ var.value.my_var }}.',
          })
        }
      }
    }
  }
  return out
}
