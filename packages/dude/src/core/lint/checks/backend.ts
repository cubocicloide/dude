import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { Diagnostic } from '../types.js'
import { Check } from '../types.js'

/** BE001 — backend/app/ must contain models/, routers/, schemas/, main.py, __init__.py */
const REQUIRED_DIRS = ['models', 'routers', 'schemas']
const REQUIRED_FILES = ['main.py', '__init__.py']

export class AppStructureCheck extends Check {
  run(root: string): Diagnostic[] {
    const appDir = path.join(root, 'backend', 'app')
    if (!existsSync(appDir)) {
      return [
        {
          file: path.join('backend', 'app'),
          line: 1,
          col: 1,
          severity: 'error',
          code: 'BE001',
          message: 'backend/app/ directory is missing',
        },
      ]
    }

    const diagnostics: Diagnostic[] = []
    for (const dir of REQUIRED_DIRS) {
      if (!existsSync(path.join(appDir, dir))) {
        diagnostics.push({
          file: path.join('backend', 'app'),
          line: 1,
          col: 1,
          severity: 'error',
          code: 'BE001',
          message: `backend/app/${dir}/ is missing`,
        })
      }
    }
    for (const file of REQUIRED_FILES) {
      if (!existsSync(path.join(appDir, file))) {
        diagnostics.push({
          file: path.join('backend', 'app'),
          line: 1,
          col: 1,
          severity: 'error',
          code: 'BE001',
          message: `backend/app/${file} is missing`,
        })
      }
    }
    return diagnostics
  }
}

/** BE002 — models/foo.py must define `class Foo` (snake_case → PascalCase) */
function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, _sep, c: string) => c.toUpperCase())
}

export class ModelNamingCheck extends Check {
  run(root: string): Diagnostic[] {
    const modelsDir = path.join(root, 'backend', 'app', 'models')
    if (!existsSync(modelsDir)) return []

    const diagnostics: Diagnostic[] = []
    for (const entry of readdirSync(modelsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
      const baseName = entry.name.replace(/\.py$/, '')
      const expectedClass = snakeToPascal(baseName)
      const filePath = path.join(modelsDir, entry.name)
      const content = readFileSync(filePath, 'utf8')
      if (!new RegExp(`class\\s+${expectedClass}\\b`).test(content)) {
        diagnostics.push({
          file: path.join('backend', 'app', 'models', entry.name),
          line: 1,
          col: 1,
          severity: 'error',
          code: 'BE002',
          message: `models/${entry.name} must define \`class ${expectedClass}\``,
        })
      }
    }
    return diagnostics
  }
}

/** BE003 — schemas/foo.py classes that inherit BaseModel/SQLModel must use the PascalCase prefix */
export class SchemaNamingCheck extends Check {
  run(root: string): Diagnostic[] {
    const schemasDir = path.join(root, 'backend', 'app', 'schemas')
    if (!existsSync(schemasDir)) return []

    const diagnostics: Diagnostic[] = []
    for (const entry of readdirSync(schemasDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
      const baseName = entry.name.replace(/\.py$/, '')
      const expectedPrefix = snakeToPascal(baseName)
      const filePath = path.join(schemasDir, entry.name)
      const content = readFileSync(filePath, 'utf8')

      // Find all schema classes
      const classRe = /^class\s+(\w+)\s*\(.*(?:BaseModel|SQLModel)/gm
      for (const m of content.matchAll(classRe)) {
        const className = m[1]!
        if (!className.startsWith(expectedPrefix)) {
          diagnostics.push({
            file: path.join('backend', 'app', 'schemas', entry.name),
            line: 1,
            col: 1,
            severity: 'error',
            code: 'BE003',
            message: `Schema class "${className}" in ${entry.name} must start with "${expectedPrefix}"`,
          })
        }
      }
    }
    return diagnostics
  }
}

/** BE004 — routers/foo.py must define `router = APIRouter(...)` */
const ROUTER_RE = /router\s*=\s*APIRouter\s*\(/

export class RouterNamingCheck extends Check {
  run(root: string): Diagnostic[] {
    const routersDir = path.join(root, 'backend', 'app', 'routers')
    if (!existsSync(routersDir)) return []

    const diagnostics: Diagnostic[] = []
    for (const entry of readdirSync(routersDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
      const filePath = path.join(routersDir, entry.name)
      const content = readFileSync(filePath, 'utf8')
      if (!ROUTER_RE.test(content)) {
        diagnostics.push({
          file: path.join('backend', 'app', 'routers', entry.name),
          line: 1,
          col: 1,
          severity: 'error',
          code: 'BE004',
          message: `routers/${entry.name} must define \`router = APIRouter(...)\``,
        })
      }
    }
    return diagnostics
  }
}
