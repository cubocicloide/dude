import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { appDir, appRel, featureNames, listPyModules, parseDecoratedFns, read } from '../../_ast.js'

const COMPONENT_PKGS = ['tools', 'resources', 'prompts']

/**
 * MCP005 — one component per module, named after the module.
 *
 * Each `tools/<name>.py` (and `resources/<name>.py`, `prompts/<name>.py`) must
 * define **exactly one** decorated component whose function is named `<name>`
 * (the module stem). This 1-module-1-component rule keeps the tree scalable:
 * a component is found by its path, and diffs/tests stay local.
 */
export default function check(root: string): RawDiagnostic[] {
  const featuresDir = path.join(appDir(root), 'features')
  const diagnostics: RawDiagnostic[] = []

  for (const feature of featureNames(root)) {
    for (const pkg of COMPONENT_PKGS) {
      const pdir = path.join(featuresDir, feature, pkg)
      for (const stem of listPyModules(pdir)) {
        const rel = appRel('features', feature, pkg, `${stem}.py`)
        const fns = parseDecoratedFns(read(path.join(pdir, `${stem}.py`)))

        if (fns.length === 0) {
          diagnostics.push(
            err(rel, `${pkg}/${stem}.py defines no component — expected exactly one @server.* function named \`${stem}\``),
          )
          continue
        }
        if (fns.length > 1) {
          diagnostics.push(
            err(rel, `${pkg}/${stem}.py defines ${fns.length} components — exactly one is allowed per module`),
          )
        }
        const primary = fns[0]!
        if (primary.name !== stem) {
          diagnostics.push(
            err(
              rel,
              `component function \`${primary.name}\` must be named after its module (\`${stem}\`)`,
              primary.line,
            ),
          )
        }
      }
    }
  }

  return diagnostics
}

function err(file: string, message: string, line = 1): RawDiagnostic {
  return { file, line, col: 1, severity: 'error', message }
}
