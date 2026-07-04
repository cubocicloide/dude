import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const REQUIREMENTS = path.join('airflow', 'requirements.txt')

/**
 * AF009 — requirements.txt pins every package.
 *
 * The image is rebuilt on every deploy; an unpinned requirement means two
 * builds of the same commit can ship different code. Pin with `==` (or `~=`
 * for a deliberate compatible-release range).
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  const abs = path.join(root, REQUIREMENTS)
  if (!existsSync(abs)) {
    out.push({
      file: REQUIREMENTS,
      line: 1,
      col: 1,
      severity: 'error',
      message: 'airflow/requirements.txt is missing — the image build expects it (may be empty).',
    })
    return out
  }

  const lines = readFileSync(abs, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (line === '' || line.startsWith('#') || line.startsWith('-')) continue
    if (!/(==|~=)/.test(line)) {
      out.push({
        file: REQUIREMENTS,
        line: i + 1,
        col: 1,
        severity: 'error',
        message: `"${line}" is not pinned — use package==X.Y.Z (or ~= for a compatible-release range).`,
      })
    }
  }
  return out
}
