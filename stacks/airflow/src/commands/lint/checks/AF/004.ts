import type { RawDiagnostic } from '@cubocicloide/dude'
import { dagFiles, findLine, readLines } from '../../_py.js'

/**
 * AF004 — every DAG carries non-empty `tags=[…]`.
 *
 * Tags are the only first-class grouping mechanism in the Airflow UI; once a
 * project has a few dozen DAGs an untagged one is effectively lost.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  for (const rel of dagFiles(root)) {
    const lines = readLines(root, rel)

    const empty = findLine(lines, /\btags\s*=\s*\[\s*\]/)
    if (empty >= 0) {
      out.push({
        file: rel,
        line: empty + 1,
        col: 1,
        severity: 'error',
        message: 'tags=[] is empty — give the DAG at least one tag (e.g. its team or domain).',
      })
      continue
    }

    if (findLine(lines, /\btags\s*=/) < 0) {
      const dagLine = findLine(lines, /\bDAG\s*\(|@dag\b/)
      out.push({
        file: rel,
        line: dagLine >= 0 ? dagLine + 1 : 1,
        col: 1,
        severity: 'error',
        message: 'DAG must set tags=[…] so it stays findable in the UI.',
      })
    }
  }
  return out
}
