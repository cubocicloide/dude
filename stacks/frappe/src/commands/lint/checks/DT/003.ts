import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Frappe's scrub(): lowercase, spaces → underscores. */
function scrub(name: string): string {
  return name.toLowerCase().replace(/ /g, '_')
}

/** Apps under apps/ that have a pyproject.toml (valid bench apps). */
function listApps(root: string): string[] {
  const appsDir = path.join(root, 'apps')
  try {
    return readdirSync(appsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(appsDir, e.name, 'pyproject.toml')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

interface DoctypeDir {
  app: string
  module: string
  name: string
  rel: string // repo-relative doctype directory
}

/** Every apps/<app>/<app>/<module>/doctype/<d>/ directory. */
function listDoctypeDirs(root: string): DoctypeDir[] {
  const out: DoctypeDir[] = []
  for (const app of listApps(root)) {
    const pkg = path.join(root, 'apps', app, app)
    let moduleDirs: string[] = []
    try {
      moduleDirs = readdirSync(pkg, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(path.join(pkg, e.name, 'doctype')))
        .map((e) => e.name)
    } catch {
      continue
    }
    for (const mod of moduleDirs) {
      let names: string[] = []
      try {
        names = readdirSync(path.join(pkg, mod, 'doctype'), { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      } catch {
        continue
      }
      for (const name of names) {
        out.push({ app, module: mod, name, rel: `apps/${app}/${app}/${mod}/doctype/${name}` })
      }
    }
  }
  return out
}

/** Modules listed in apps/<app>/<app>/modules.txt (one per line). */
function readModules(root: string, app: string): string[] {
  try {
    return readFileSync(path.join(root, 'apps', app, app, 'modules.txt'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * DT003 — Naming and module registration.
 *
 * For every DocType schema: scrub(name) must equal its directory name, its
 * `module` must be listed in modules.txt, and scrub(module) must equal the
 * module directory that contains doctype/. Any mismatch and `bench migrate`
 * either cannot find the DocType or files it under a module that does not exist.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  const modulesByApp = new Map<string, string[]>()

  for (const dt of listDoctypeDirs(root)) {
    const jsonRel = `${dt.rel}/${dt.name}.json`
    const jsonAbs = path.join(root, jsonRel)
    if (!existsSync(jsonAbs)) continue // DT001 reports the missing schema

    let schema: Record<string, unknown>
    try {
      schema = JSON.parse(readFileSync(jsonAbs, 'utf8')) as Record<string, unknown>
    } catch {
      continue // DT002 reports the unparseable schema
    }

    const docName = typeof schema['name'] === 'string' ? (schema['name'] as string) : ''
    const docModule = typeof schema['module'] === 'string' ? (schema['module'] as string) : ''

    // (a) scrub(name) ↔ doctype directory name
    if (scrub(docName) !== dt.name) {
      diagnostics.push({
        file: jsonRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `DocType name "${docName}" does not match its directory: expected the directory to be named "${scrub(docName)}", found "${dt.name}"`,
      })
    }

    // (b) module registered in modules.txt
    if (!modulesByApp.has(dt.app)) modulesByApp.set(dt.app, readModules(root, dt.app))
    const modules = modulesByApp.get(dt.app)!
    if (!modules.includes(docModule)) {
      diagnostics.push({
        file: jsonRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `DocType "${docName}" declares module "${docModule}", which is not listed in apps/${dt.app}/${dt.app}/modules.txt — unregistered modules break \`bench migrate\``,
      })
    }

    // (c) scrub(module) ↔ module directory name
    if (scrub(docModule) !== dt.module) {
      diagnostics.push({
        file: jsonRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `DocType "${docName}" declares module "${docModule}" but lives under the "${dt.module}" module directory — expected "${scrub(docModule)}/doctype/${dt.name}/"`,
      })
    }
  }

  return diagnostics
}
