import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { PLUGINS_DIR, walk } from '../../_py.js'

/**
 * AF008 — plugins are packages that register an AirflowPlugin.
 *
 * Every plugin lives in its own package directory
 * (`airflow/plugins/<name>/__init__.py` defining a `class …(AirflowPlugin)`),
 * never as a loose module dropped into `plugins/`. This keeps each plugin's
 * operators / macros / listeners grouped and independently removable.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  const pluginsAbs = path.join(root, PLUGINS_DIR)
  if (!existsSync(pluginsAbs)) return out

  for (const entry of readdirSync(pluginsAbs)) {
    if (entry === '__init__.py' || entry === '.gitkeep' || entry === 'README.md') continue
    const abs = path.join(pluginsAbs, entry)
    const rel = `${PLUGINS_DIR}/${entry}`

    if (!statSync(abs).isDirectory()) {
      out.push({
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message:
          'Loose file in airflow/plugins/ — move it into a package: plugins/<name>/__init__.py.',
      })
      continue
    }

    const initFile = path.join(abs, '__init__.py')
    if (!existsSync(initFile)) {
      out.push({
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message: 'Plugin package is missing __init__.py.',
      })
      continue
    }

    const registers = walk(abs)
      .filter((p) => p.endsWith('.py'))
      .some((p) => /class\s+\w+\s*\(\s*AirflowPlugin\s*\)/.test(readFileSync(p, 'utf8')))
    if (!registers) {
      out.push({
        file: `${rel}/__init__.py`,
        line: 1,
        col: 1,
        severity: 'error',
        message:
          'Plugin package never subclasses AirflowPlugin — Airflow will not load it. ' +
          'Define `class <Name>Plugin(AirflowPlugin)` (conventionally in __init__.py).',
      })
    }
  }
  return out
}
