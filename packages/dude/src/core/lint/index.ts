import type { Diagnostic } from './types.js'
import { formatDiagnostic } from './types.js'
import {
  ComponentNamingCheck,
  ComponentFilesCheck,
  BarrelExportsCheck,
  PageRoutesCheck,
  PageFilesCheck,
  HookFilesCheck,
  HookBarrelCheck,
} from './checks/frontend.js'
import {
  AppStructureCheck,
  ModelNamingCheck,
  SchemaNamingCheck,
  RouterNamingCheck,
} from './checks/backend.js'

const ALL_CHECKS = [
  new ComponentNamingCheck(),
  new ComponentFilesCheck(),
  new BarrelExportsCheck(),
  new PageRoutesCheck(),
  new PageFilesCheck(),
  new HookFilesCheck(),
  new HookBarrelCheck(),
  new AppStructureCheck(),
  new ModelNamingCheck(),
  new SchemaNamingCheck(),
  new RouterNamingCheck(),
]

export interface LintResult {
  diagnostics: Diagnostic[]
  errorCount: number
  warningCount: number
}

export async function runLint(root: string): Promise<LintResult> {
  const all: Diagnostic[] = []
  for (const check of ALL_CHECKS) {
    const results = await check.run(root)
    all.push(...results)
  }

  all.sort((a, b) => {
    const fileOrder = a.file.localeCompare(b.file)
    if (fileOrder !== 0) return fileOrder
    if (a.line !== b.line) return a.line - b.line
    return a.col - b.col
  })

  return {
    diagnostics: all,
    errorCount: all.filter((d) => d.severity === 'error').length,
    warningCount: all.filter((d) => d.severity === 'warning').length,
  }
}

export { formatDiagnostic }
export type { Diagnostic }
