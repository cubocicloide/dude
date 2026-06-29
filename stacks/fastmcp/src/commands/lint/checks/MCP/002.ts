import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { appDir, appRel, featureNames, isDir, isFile } from '../../_ast.js'

/** Component packages; a feature must have at least one of these. */
const COMPONENT_PKGS = ['tools', 'resources', 'prompts']

/**
 * MCP002 — feature package shape.
 *
 * Each `features/<name>/` must contain `__init__.py`, `_server.py`, **at least
 * one** component package (`tools/`, `resources/`, `prompts/`), and a `utils/`
 * package. Every present component package and `utils/` carries an `__init__.py`.
 */
export default function check(root: string): RawDiagnostic[] {
  const app = appDir(root)
  const featuresDir = path.join(app, 'features')
  if (!isDir(featuresDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const feature of featureNames(root)) {
    const fdir = path.join(featuresDir, feature)
    const frel = appRel('features', feature)

    if (!isFile(path.join(fdir, '__init__.py'))) {
      diagnostics.push(err(frel, `features/${feature}/__init__.py is missing`))
    }
    if (!isFile(path.join(fdir, '_server.py'))) {
      diagnostics.push(err(frel, `features/${feature}/_server.py is missing`))
    }

    const present = COMPONENT_PKGS.filter((p) => isDir(path.join(fdir, p)))
    if (present.length === 0) {
      diagnostics.push(
        err(
          frel,
          `features/${feature}/ must contain at least one component package (tools/, resources/, prompts/)`,
        ),
      )
    }

    // utils/ package is required.
    if (!isDir(path.join(fdir, 'utils'))) {
      diagnostics.push(err(frel, `features/${feature}/utils/ package is missing`))
    }

    // Every present package must carry an __init__.py.
    for (const pkg of [...present, 'utils']) {
      const pdir = path.join(fdir, pkg)
      if (isDir(pdir) && !isFile(path.join(pdir, '__init__.py'))) {
        diagnostics.push(
          err(appRel('features', feature, pkg), `features/${feature}/${pkg}/__init__.py is missing`),
        )
      }
    }
  }

  return diagnostics
}

function err(file: string, message: string): RawDiagnostic {
  return { file, line: 1, col: 1, severity: 'error', message }
}
