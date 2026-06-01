export type Severity = 'error' | 'warning'

export interface Diagnostic {
  file: string
  line: number
  col: number
  severity: Severity
  code: string
  message: string
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.file}(${d.line},${d.col}): ${d.severity} ${d.code}: ${d.message}`
}

export abstract class Check {
  abstract run(root: string): Diagnostic[] | Promise<Diagnostic[]>
}
