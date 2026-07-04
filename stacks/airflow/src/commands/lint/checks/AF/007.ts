import type { RawDiagnostic } from '@cubocicloide/dude'
import { dagFiles, readLines, stripComment } from '../../_py.js'

const HEAVY = ['pandas', 'numpy', 'torch', 'tensorflow', 'sklearn', 'scipy', 'polars', 'pyarrow']

/**
 * AF007 — no heavy imports at DAG-file top level.
 *
 * Top-level imports run on every parse cycle of the dag-processor; a single
 * `import pandas` adds hundreds of milliseconds to every DAG file in the
 * project. Import heavy libraries inside the task functions that use them.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  const re = new RegExp(`^\\s*(import|from)\\s+(${HEAVY.join('|')})\\b`)
  for (const rel of dagFiles(root)) {
    const lines = readLines(root, rel)
    for (let i = 0; i < lines.length; i++) {
      const line = stripComment(lines[i] ?? '')
      // Only module-scope imports (column 0) — an indented import is already
      // inside a function or guarded block.
      if (/^\S/.test(line) && re.test(line)) {
        const mod = line.match(re)?.[2] ?? 'module'
        out.push({
          file: rel,
          line: i + 1,
          col: 1,
          severity: 'warning',
          message: `Top-level import of ${mod} slows every DAG parse — import it inside the task function that uses it.`,
        })
      }
    }
  }
  return out
}
