import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Extract module names from `from app.routers import (name1, name2, ...)` */
function parseRouterImports(content: string): Set<string> {
  const names = new Set<string>()
  const lines = content.split('\n')
  let inBlock = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!inBlock) {
      const singleLineMatch = trimmed.match(/^from\s+app\.routers\s+import\s+\(([^)]+)\)/)
      if (singleLineMatch?.[1]) {
        for (const n of singleLineMatch[1].split(',')) {
          const name = n.trim()
          if (name) names.add(name)
        }
        continue
      }
      if (/^from\s+app\.routers\s+import\s+\(/.test(trimmed)) {
        inBlock = true
        continue
      }
      const inlineMatch = trimmed.match(/^from\s+app\.routers\s+import\s+(\w+)/)
      if (inlineMatch?.[1]) names.add(inlineMatch[1])
    } else {
      if (trimmed.includes(')')) {
        inBlock = false
        const part = trimmed.slice(0, trimmed.indexOf(')'))
        for (const n of part.split(',')) {
          const name = n.trim()
          if (name) names.add(name)
        }
      } else {
        for (const n of trimmed.split(',')) {
          const name = n.trim()
          if (name) names.add(name)
        }
      }
    }
  }
  return names
}

/** Extract module names from `.include_router(module.router)` calls */
function parseIncludedRouters(content: string): Set<string> {
  const names = new Set<string>()
  const re = /\.include_router\(\s*(\w+)\.router[\s,)]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m[1]) names.add(m[1])
  }
  return names
}

/** BE005 — main.py must import and include_router every module in routers/, and only those */
export default function check(root: string): RawDiagnostic[] {
  const routersDir = path.join(root, 'backend', 'app', 'routers')
  const mainPy = path.join(root, 'backend', 'app', 'main.py')
  if (!existsSync(routersDir) || !existsSync(mainPy)) return []

  const stems = new Set(
    readdirSync(routersDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.py') && e.name !== '__init__.py')
      .map((e) => e.name.slice(0, -3)),
  )

  const content = readFileSync(mainPy, 'utf8')
  const mainRel = path.join('backend', 'app', 'main.py')
  const imported = parseRouterImports(content)
  const included = parseIncludedRouters(content)
  const diagnostics: RawDiagnostic[] = []

  for (const stem of stems) {
    if (!imported.has(stem))
      diagnostics.push({
        file: mainRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `routers/${stem}.py exists but is not imported in main.py`,
      })
    if (!included.has(stem))
      diagnostics.push({
        file: mainRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `routers/${stem}.router is not registered via include_router() in main.py`,
      })
  }
  for (const name of imported) {
    if (!stems.has(name))
      diagnostics.push({
        file: mainRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `main.py imports \`${name}\` from app.routers but routers/${name}.py does not exist`,
      })
  }
  for (const name of included) {
    if (!stems.has(name))
      diagnostics.push({
        file: mainRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `main.py calls include_router(${name}.router) but routers/${name}.py does not exist`,
      })
  }

  return diagnostics
}
