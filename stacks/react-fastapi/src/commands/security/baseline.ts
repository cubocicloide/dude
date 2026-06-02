import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'pathe'
import { type Finding, SEV_LABEL, fingerprint } from './models.js'

export interface BaselineEntry {
  fingerprint: string
  tool: string
  ruleId: string
  severity: string
  file: string
  title: string
  firstSeen: string
  notes: string
}

export class Baseline {
  constructor(public entries: Map<string, BaselineEntry> = new Map()) {}

  static load(filePath: string): Baseline {
    if (!existsSync(filePath)) return new Baseline()
    const raw = readFileSync(filePath, 'utf8') || '{}'
    const data = JSON.parse(raw) as { entries?: Record<string, Record<string, string>> }
    const entries = new Map<string, BaselineEntry>()
    for (const [fp, row] of Object.entries(data.entries ?? {})) {
      entries.set(fp, {
        fingerprint: fp,
        tool: row['tool'] ?? '',
        ruleId: row['rule_id'] ?? '',
        severity: row['severity'] ?? '',
        file: row['file'] ?? '',
        title: row['title'] ?? '',
        firstSeen: row['first_seen'] ?? '',
        notes: row['notes'] ?? '',
      })
    }
    return new Baseline(entries)
  }

  save(filePath: string): void {
    mkdirSync(path.dirname(filePath), { recursive: true })
    const sorted = [...this.entries.entries()].sort(([a], [b]) => a.localeCompare(b))
    const payload = {
      generated_at: new Date().toISOString(),
      entries: Object.fromEntries(
        sorted.map(([fp, e]) => [
          fp,
          {
            tool: e.tool,
            rule_id: e.ruleId,
            severity: e.severity,
            file: e.file,
            title: e.title,
            first_seen: e.firstSeen,
            notes: e.notes,
          },
        ]),
      ),
    }
    writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n')
  }

  updateFrom(findings: Finding[]): void {
    const now = new Date().toISOString()
    for (const f of findings) {
      const fp = fingerprint(f)
      if (this.entries.has(fp)) continue
      this.entries.set(fp, {
        fingerprint: fp,
        tool: f.tool,
        ruleId: f.ruleId,
        severity: SEV_LABEL[f.severity],
        file: f.file,
        title: f.title,
        firstSeen: now,
        notes: '',
      })
    }
  }

  classify(findings: Finding[]): {
    newFindings: Finding[]
    knownFindings: Finding[]
    resolved: string[]
  } {
    const currentFps = new Set(findings.map(fingerprint))
    const newFindings = findings.filter((f) => !this.entries.has(fingerprint(f)))
    const knownFindings = findings.filter((f) => this.entries.has(fingerprint(f)))
    const resolved = [...this.entries.keys()].filter((fp) => !currentFps.has(fp)).sort()
    return { newFindings, knownFindings, resolved }
  }
}
