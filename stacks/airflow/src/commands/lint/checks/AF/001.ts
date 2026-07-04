import type { RawDiagnostic } from '@cubocicloide/dude'
import path from 'pathe'
import { dagFiles, findLine, readLines, stripComment } from '../../_py.js'

/**
 * AF001 — dag_id ↔ filename parity.
 *
 * Every DAG file must declare exactly one DAG with an explicit `dag_id` equal
 * to the file name (without `.py`). One DAG per file keeps `airflow/dags/`
 * greppable: the id you see in the UI is the file you open.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  for (const rel of dagFiles(root)) {
    const lines = readLines(root, rel)
    const stem = path.basename(rel, '.py')

    const ids: Array<{ id: string; line: number }> = []
    for (let i = 0; i < lines.length; i++) {
      const m = stripComment(lines[i] ?? '').match(/\bdag_id\s*=\s*["']([^"']+)["']/)
      if (m?.[1]) ids.push({ id: m[1], line: i + 1 })
    }

    const first = ids[0]
    const second = ids[1]
    if (!first) {
      const dagLine = findLine(lines, /\bDAG\s*\(|@dag\b/)
      out.push({
        file: rel,
        line: dagLine >= 0 ? dagLine + 1 : 1,
        col: 1,
        severity: 'error',
        message:
          'DAG file must declare an explicit dag_id="…" (matching the file name). ' +
          'Move shared helpers into airflow/dags/lib/ if this file defines no DAG.',
      })
      continue
    }
    if (second) {
      out.push({
        file: rel,
        line: second.line,
        col: 1,
        severity: 'error',
        message: `One DAG per file: found ${ids.length} dag_id declarations — split each DAG into its own file.`,
      })
    }
    if (first.id !== stem) {
      out.push({
        file: rel,
        line: first.line,
        col: 1,
        severity: 'error',
        message: `dag_id "${first.id}" must match the file name "${stem}" (rename one of them).`,
      })
    }
  }
  return out
}
