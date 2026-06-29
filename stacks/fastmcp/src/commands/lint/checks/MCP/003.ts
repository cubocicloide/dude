import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { appDir, appRel, featureNames, isFile, read } from '../../_ast.js'

/**
 * MCP003 — sub-server contract.
 *
 * `_server.py` must define a module-level `server = FastMCP(name="<folder>")`
 * whose name equals the feature folder. `__init__.py` must re-export `server`
 * (`__all__ = ["server"]`) and trigger component registration (an
 * `import_submodules(...)` call, or direct imports of the component packages).
 */
export default function check(root: string): RawDiagnostic[] {
  const featuresDir = path.join(appDir(root), 'features')
  const diagnostics: RawDiagnostic[] = []

  for (const feature of featureNames(root)) {
    const fdir = path.join(featuresDir, feature)

    // ── _server.py ────────────────────────────────────────────────────────────
    const serverPath = path.join(fdir, '_server.py')
    if (isFile(serverPath)) {
      const rel = appRel('features', feature, '_server.py')
      const src = read(serverPath)
      const m = /^\s*server\s*=\s*FastMCP\s*\(([^)]*)\)/m.exec(src)
      if (!m) {
        diagnostics.push(
          err(rel, `_server.py must define a module-level \`server = FastMCP(name="${feature}")\``),
        )
      } else {
        const nameMatch = /name\s*=\s*["']([^"']*)["']/.exec(m[1] ?? '')
        if (!nameMatch) {
          diagnostics.push(err(rel, `FastMCP(name=…) must be a string literal naming the feature`))
        } else if (nameMatch[1] !== feature) {
          diagnostics.push(
            err(
              rel,
              `FastMCP name "${nameMatch[1]}" must equal the feature folder "${feature}"`,
            ),
          )
        }
      }
    }

    // ── __init__.py ───────────────────────────────────────────────────────────
    const initPath = path.join(fdir, '__init__.py')
    if (isFile(initPath)) {
      const rel = appRel('features', feature, '__init__.py')
      const src = read(initPath)

      const reExports = /\bimport\s+server\b/.test(src) && /__all__\s*=\s*\[[^\]]*["']server["']/.test(src)
      if (!reExports) {
        diagnostics.push(
          err(rel, `__init__.py must import and re-export \`server\` (\`__all__ = ["server"]\`)`),
        )
      }

      const registers =
        /\bimport_submodules\s*\(/.test(src) ||
        /\bfrom\s+\.(tools|resources|prompts)\b/.test(src) ||
        /\bimport\s+(tools|resources|prompts)\b/.test(src)
      if (!registers) {
        diagnostics.push(
          err(
            rel,
            `__init__.py must trigger component registration (call import_submodules(__name__, __path__) or import the component packages)`,
          ),
        )
      }
    }
  }

  return diagnostics
}

function err(file: string, message: string): RawDiagnostic {
  return { file, line: 1, col: 1, severity: 'error', message }
}
