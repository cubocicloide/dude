export type Severity = 'error' | 'warning'

/**
 * What a check function returns — no `code` field.
 * The code is derived from the file path: checks/FE/001.ts → "FE001".
 */
export interface RawDiagnostic {
  file: string
  line: number
  col: number
  severity: Severity
  message: string
}

/** Full diagnostic enriched by the runner with the path-derived code. */
export interface Diagnostic extends RawDiagnostic {
  code: string
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.file}(${d.line},${d.col}): ${d.severity} ${d.code}: ${d.message}`
}

/**
 * Contract for every check file's default export.
 * File location determines the code: checks/{GROUP}/{id}.ts → {GROUP}{id}
 */
export type CheckFn = (root: string) => RawDiagnostic[] | Promise<RawDiagnostic[]>
