/**
 * Small dependency-free helpers for the AF lint checks. Deliberately outside
 * `checks/` so neither tsup nor the runtime treats this module as a check.
 *
 * These are line-oriented heuristics, not a Python parser — they trade
 * exhaustive correctness for zero dependencies, which is plenty for enforcing
 * scaffold conventions on conventional DAG files.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'pathe'

export const DAGS_DIR = path.join('airflow', 'dags')
export const PLUGINS_DIR = path.join('airflow', 'plugins')

/** Recursively list files under `dir` (absolute paths). Returns [] when missing. */
export function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

/**
 * The project's DAG definition files: every `*.py` under `airflow/dags/`
 * except the shared `lib/` package and `__init__.py` files. Paths are
 * project-root-relative (posix separators).
 */
export function dagFiles(root: string): string[] {
  const dags = path.join(root, DAGS_DIR)
  return walk(dags)
    .filter((p) => p.endsWith('.py'))
    .map((p) => path.relative(root, p))
    .filter((rel) => !rel.startsWith(`${DAGS_DIR}/lib/`) && path.basename(rel) !== '__init__.py')
}

export function readLines(root: string, rel: string): string[] {
  return readFileSync(path.join(root, rel), 'utf8').split('\n')
}

/** Strip a trailing `#` comment from a line (naive: ignores '#' inside strings conservatively). */
export function stripComment(line: string): string {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (ch === '#' && !inSingle && !inDouble) return line.slice(0, i)
  }
  return line
}

/**
 * For every line, whether it executes at DAG-parse time — i.e. it is NOT
 * inside a `def`/`async def` body. Parse-time lines include module scope AND
 * the body of `with DAG(...)` blocks; only function bodies run at task
 * runtime. Tracked by indentation: a `def` at indent N owns every following
 * line with indent > N.
 */
export function parseTimeMask(lines: string[]): boolean[] {
  const mask: boolean[] = []
  // Stack of indents of enclosing `def` statements.
  const defStack: number[] = []
  for (const raw of lines) {
    const line = stripComment(raw)
    const trimmed = line.trim()
    if (trimmed === '') {
      mask.push(false) // blank lines never report anything
      continue
    }
    const indent = line.length - line.trimStart().length
    while (defStack.length && indent <= (defStack[defStack.length - 1] ?? -1)) defStack.pop()
    mask.push(defStack.length === 0)
    if (/^(async\s+)?def\s+\w+/.test(trimmed)) defStack.push(indent)
  }
  return mask
}

/** First line index (0-based) matching `re`, or -1. Comments are stripped first. */
export function findLine(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(stripComment(lines[i] ?? ''))) return i
  }
  return -1
}
