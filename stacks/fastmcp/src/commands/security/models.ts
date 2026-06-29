import { createHash } from 'node:crypto'

// ── Severity ───────────────────────────────────────────────────────────────────

export enum Severity {
  UNKNOWN = 0,
  INFO = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  CRITICAL = 5,
}

export const SEV_LABEL: Record<Severity, string> = {
  [Severity.UNKNOWN]: 'UNKNOWN',
  [Severity.INFO]: 'INFO',
  [Severity.LOW]: 'LOW',
  [Severity.MEDIUM]: 'MEDIUM',
  [Severity.HIGH]: 'HIGH',
  [Severity.CRITICAL]: 'CRITICAL',
}

const _NAMED: Record<string, Severity> = {
  UNKNOWN: Severity.UNKNOWN,
  INFO: Severity.INFO,
  LOW: Severity.LOW,
  MEDIUM: Severity.MEDIUM,
  HIGH: Severity.HIGH,
  CRITICAL: Severity.CRITICAL,
  // Aliases used by some tools
  NOTE: Severity.INFO,
  WARNING: Severity.MEDIUM,
  MODERATE: Severity.MEDIUM,
  ERROR: Severity.HIGH,
  SEVERE: Severity.HIGH,
}

export function parseSeverity(value: string | undefined): Severity {
  if (!value) return Severity.UNKNOWN
  return _NAMED[value.trim().toUpperCase()] ?? Severity.UNKNOWN
}

// ── Finding ────────────────────────────────────────────────────────────────────

export interface Finding {
  tool: string
  ruleId: string
  severity: Severity
  title: string
  message: string
  file: string
  line: number
  component: string
  extra: Record<string, string>
}

/**
 * Stable fingerprint that correlates a finding across runs.
 * Intentionally excludes line number (refactors shift lines).
 * Based on (tool, rule_id, file, normalised title).
 */
export function fingerprint(f: Finding): string {
  const raw = [f.tool, f.ruleId, f.file, f.title.trim().toLowerCase()].join('|')
  return createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16)
}

export function findingToRecord(f: Finding): Record<string, unknown> {
  return {
    tool: f.tool,
    rule_id: f.ruleId,
    severity: SEV_LABEL[f.severity],
    title: f.title,
    message: f.message,
    file: f.file,
    line: f.line,
    component: f.component,
    extra: f.extra,
    fingerprint: fingerprint(f),
  }
}
