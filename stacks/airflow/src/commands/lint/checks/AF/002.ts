import type { RawDiagnostic } from '@cubocicloide/dude'
import { dagFiles, findLine, readLines } from '../../_py.js'

/**
 * AF002 — explicit `schedule=`, never `schedule_interval=`.
 *
 * Every DAG must state its schedule explicitly (`schedule="@daily"`,
 * `schedule=None`, a Timetable, …) so nobody has to remember Airflow's
 * default. `schedule_interval` was removed in Airflow 3 — files still using
 * it silently fail to import.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  for (const rel of dagFiles(root)) {
    const lines = readLines(root, rel)

    const legacy = findLine(lines, /\bschedule_interval\s*=/)
    if (legacy >= 0) {
      out.push({
        file: rel,
        line: legacy + 1,
        col: 1,
        severity: 'error',
        message: 'schedule_interval= was removed in Airflow 3 — use schedule= instead.',
      })
    }

    if (findLine(lines, /\bschedule\s*=/) < 0) {
      const dagLine = findLine(lines, /\bDAG\s*\(|@dag\b/)
      out.push({
        file: rel,
        line: dagLine >= 0 ? dagLine + 1 : 1,
        col: 1,
        severity: 'error',
        message: 'DAG must set schedule= explicitly (use schedule=None for manual-only DAGs).',
      })
    }
  }
  return out
}
