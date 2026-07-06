import type { RawDiagnostic } from '@cubocicloide/dude'
import { dagFiles, findLine, readLines } from '../../_py.js'

/**
 * AF005 — default_args come from the shared `lib.defaults` module.
 *
 * Owner, retries and retry backoff should be policy, not copy-paste: every
 * DAG imports `DEFAULT_ARGS` from `airflow/dags/lib/defaults.py` and passes
 * it (possibly extended with `{**DEFAULT_ARGS, …}`) as `default_args=`.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  for (const rel of dagFiles(root)) {
    const lines = readLines(root, rel)

    const hasImport = findLine(lines, /from\s+lib\.defaults\s+import\s+.*DEFAULT_ARGS/) >= 0
    const argLine = findLine(lines, /\bdefault_args\s*=/)

    if (!hasImport) {
      out.push({
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message:
          'DAG must import the shared defaults: `from lib.defaults import DEFAULT_ARGS` ' +
          '(see airflow/dags/lib/defaults.py).',
      })
      continue
    }
    if (argLine < 0) {
      const dagLine = findLine(lines, /\bDAG\s*\(|@dag\b/)
      out.push({
        file: rel,
        line: dagLine >= 0 ? dagLine + 1 : 1,
        col: 1,
        severity: 'error',
        message:
          'DAG must pass default_args=DEFAULT_ARGS (or {**DEFAULT_ARGS, …} to extend it).',
      })
    }
  }
  return out
}
