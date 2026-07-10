import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import {
  HOOK_NAME,
  PASCAL_CASE,
  collectPageNodes,
  diag,
  findDirsNamed,
  frontendSrc,
} from '../../frontend-structure'

type Scope = 'component' | 'hook' | 'page'

const TYPE_RE = /^(?:export\s+)?(?:declare\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/gm
const FUNCTION_RE = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm
const ARROW_RE = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)[^=\n]*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/gm
const DEFAULT_EXPORT_RE = /^export\s+default\s+(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)/m

function matchNames(content: string, re: RegExp): string[] {
  return [...content.matchAll(re)].map((m) => m[1]!)
}

/** FE012 — index.tsx should only hold its own component/hook/page: types, helpers and extra components belong elsewhere */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = frontendSrc(root)
  if (!existsSync(srcDir)) return []

  const results: RawDiagnostic[] = []

  function inspect(indexFile: string, scope: Scope): void {
    if (!existsSync(indexFile)) return
    const content = readFileSync(indexFile, 'utf8')

    const types = matchNames(content, TYPE_RE)
    if (types.length > 0) {
      results.push(
        diag(
          root,
          indexFile,
          'warning',
          `index.tsx declares type(s) ${types.join(', ')} — move them to types.tsx in the same directory`,
        ),
      )
    }

    const declared = [...matchNames(content, FUNCTION_RE), ...matchNames(content, ARROW_RE)]
    const components = declared.filter((n) => PASCAL_CASE.test(n))
    const hooks = declared.filter((n) => HOOK_NAME.test(n))
    const helpers = declared.filter((n) => !PASCAL_CASE.test(n) && !HOOK_NAME.test(n))

    const mainName = content.match(DEFAULT_EXPORT_RE)?.[1]
    const main = scope === 'hook' ? hooks : components
    const extras = main.filter((n) => n !== (mainName ?? main[0]))

    if (scope === 'hook') {
      if (extras.length > 0) {
        results.push(
          diag(
            root,
            indexFile,
            'warning',
            `index.tsx declares extra hook(s) ${extras.join(', ')} — give each hook its own directory under a $hooks/`,
          ),
        )
      }
      if (components.length > 0) {
        results.push(
          diag(
            root,
            indexFile,
            'warning',
            `index.tsx declares component(s) ${components.join(', ')} — a hook should not define components; move them to a $components/ scope`,
          ),
        )
      }
    } else {
      if (extras.length > 0) {
        results.push(
          diag(
            root,
            indexFile,
            'warning',
            `index.tsx declares extra component(s) ${extras.join(', ')} — move each into its own directory under $components/`,
          ),
        )
      }
      if (hooks.length > 0) {
        results.push(
          diag(
            root,
            indexFile,
            'warning',
            `index.tsx declares hook(s) ${hooks.join(', ')} — move each into its own directory under $hooks/`,
          ),
        )
      }
    }

    if (helpers.length > 0) {
      results.push(
        diag(
          root,
          indexFile,
          'warning',
          `index.tsx declares helper function(s) ${helpers.join(', ')} — move them to functions.tsx in the same directory`,
        ),
      )
    }
  }

  for (const componentsDir of findDirsNamed(srcDir, '$components')) {
    for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !PASCAL_CASE.test(entry.name)) continue
      inspect(path.join(componentsDir, entry.name, 'index.tsx'), 'component')
    }
  }
  for (const hooksDir of findDirsNamed(srcDir, '$hooks')) {
    for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !HOOK_NAME.test(entry.name)) continue
      inspect(path.join(hooksDir, entry.name, 'index.tsx'), 'hook')
    }
  }
  const pagesDir = path.join(srcDir, 'pages')
  for (const route of collectPageNodes(pagesDir)) {
    inspect(path.join(pagesDir, route, 'index.tsx'), 'page')
  }

  return results
}
