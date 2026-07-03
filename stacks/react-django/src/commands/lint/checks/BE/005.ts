import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Direct manager write calls: Model.objects.create(...), get_or_create, bulk ops… */
const MANAGER_WRITE_RE =
  /\bobjects\.(create|update_or_create|get_or_create|bulk_create|bulk_update)\(/

/** .delete() / .update( chained off an `.objects…` queryset or self.get_queryset() */
const CHAIN_WRITE_RE = /(\bobjects\b|self\.get_queryset\(\)).*?\.(delete\(\)|update\()/

const MESSAGE = 'Write operations belong in services.py or the serializer — views orchestrate only.'

function walkFiles(
  dir: string,
  fileName: string,
  cb: (abs: string, rel: string) => void,
  relBase = '',
): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    const rel = relBase ? `${relBase}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (e.name !== 'migrations' && e.name !== '__pycache__') walkFiles(abs, fileName, cb, rel)
    } else if (e.isFile() && e.name === fileName) {
      cb(abs, rel)
    }
  }
}

/** BE005 — no ORM write operations inside views.py */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'backend', 'apps')
  if (!existsSync(appsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  walkFiles(appsDir, 'views.py', (abs, rel) => {
    let content: string
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      return
    }
    const fileRel = path.join('backend', 'apps', rel)
    content.split('\n').forEach((line, idx) => {
      if (line.trimStart().startsWith('#')) return
      const m = MANAGER_WRITE_RE.exec(line) ?? CHAIN_WRITE_RE.exec(line)
      if (m) {
        diagnostics.push({
          file: fileRel,
          line: idx + 1,
          col: m.index + 1,
          severity: 'error',
          message: MESSAGE,
        })
      }
    })
  })

  return diagnostics
}
