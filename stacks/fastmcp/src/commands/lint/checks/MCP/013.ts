import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectComponentModules } from '../../_ast.js'

interface Loc {
  file: string
  line: number
  feature: string
}

/**
 * MCP013 — no duplicate tool/prompt names or resource URIs.
 *
 * Features mount into a flat namespace, so two features must not export the same
 * tool name, prompt name, or resource URI — collisions silently shadow at mount
 * time.
 */
export default function check(root: string): RawDiagnostic[] {
  const tools = new Map<string, Loc[]>()
  const prompts = new Map<string, Loc[]>()
  const resources = new Map<string, Loc[]>()

  for (const mod of collectComponentModules(root)) {
    for (const fn of mod.fns) {
      const loc: Loc = { file: mod.rel, line: fn.line, feature: mod.feature }
      const key = fn.kind === 'resource' ? (fn.uri ?? `<no-uri:${mod.rel}>`) : fn.name
      const bucket = fn.kind === 'tool' ? tools : fn.kind === 'prompt' ? prompts : resources
      ;(bucket.get(key) ?? bucket.set(key, []).get(key)!).push(loc)
    }
  }

  const diagnostics: RawDiagnostic[] = []
  collect(tools, 'tool', diagnostics)
  collect(prompts, 'prompt', diagnostics)
  collect(resources, 'resource URI', diagnostics)
  return diagnostics
}

function collect(map: Map<string, Loc[]>, label: string, out: RawDiagnostic[]): void {
  for (const [key, locs] of map) {
    if (locs.length < 2) continue
    const features = [...new Set(locs.map((l) => l.feature))].join(', ')
    for (const loc of locs) {
      out.push({
        file: loc.file,
        line: loc.line,
        col: 1,
        severity: 'error',
        message: `duplicate ${label} \`${key}\` — also defined in feature(s) [${features}]; the flat namespace would shadow it`,
      })
    }
  }
}
