import type { RawDiagnostic } from '@cubocicloide/dude'
import { dagFiles, findLine, readLines } from '../../_py.js'

/**
 * AF003 — explicit `catchup=`.
 *
 * Whether a DAG back-fills every missed interval on unpause is one of the
 * most surprising Airflow behaviours; each DAG must decide it explicitly.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  for (const rel of dagFiles(root)) {
    const lines = readLines(root, rel)
    if (findLine(lines, /\bcatchup\s*=/) < 0) {
      const dagLine = findLine(lines, /\bDAG\s*\(|@dag\b/)
      out.push({
        file: rel,
        line: dagLine >= 0 ? dagLine + 1 : 1,
        col: 1,
        severity: 'error',
        message:
          'DAG must set catchup= explicitly (catchup=False unless you really want back-fills).',
      })
    }
  }
  return out
}
