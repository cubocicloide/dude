import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { type Finding, Severity, SEV_LABEL, findingToRecord } from './models.js'
import { Baseline } from './baseline.js'
import { ALL_ADAPTERS, DEFAULT_ADAPTERS, type AdapterOpts } from './adapters.js'

// ── Display helpers ────────────────────────────────────────────────────────────

function section(title: string) {
  const isTTY = process.stdout.isTTY
  const line = '─'.repeat(Math.max(0, 52 - title.length))
  const header = `── ${title} ${line}`
  process.stdout.write(isTTY ? `\n\x1b[1m${header}\x1b[0m\n` : `\n${header}\n`)
}

// ── Arg helpers ────────────────────────────────────────────────────────────────

function parseAdapters(only: string | undefined): string[] {
  if (!only) return [...DEFAULT_ADAPTERS]
  return only
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseSeverityArg(value: string | undefined, fallback: Severity): Severity {
  if (!value) return fallback
  const map: Record<string, Severity> = {
    INFO: Severity.INFO,
    LOW: Severity.LOW,
    MEDIUM: Severity.MEDIUM,
    HIGH: Severity.HIGH,
    CRITICAL: Severity.CRITICAL,
  }
  return map[value.trim().toUpperCase()] ?? fallback
}

// ── Docker check ───────────────────────────────────────────────────────────────

function ensureDocker(): void {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' })
  if (r.error != null || r.status !== 0) {
    process.stderr.write(
      '[security] docker is required but is not available or the daemon is not running.\n',
    )
    process.exit(2)
  }
}

// ── Output writers ─────────────────────────────────────────────────────────────

const MAX_MESSAGE_LEN = 500

function truncate(text: string): string {
  const cleaned = text.trim().replace(/\n/g, ' ')
  return cleaned.length > MAX_MESSAGE_LEN ? cleaned.slice(0, MAX_MESSAGE_LEN - 1) + '…' : cleaned
}

function writeFindingsJson(findings: Finding[], filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true })
  const payload = {
    generated_at: new Date().toISOString(),
    count: findings.length,
    findings: findings.map(findingToRecord),
  }
  writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n')
}

function writeMarkdownSummary(
  newFindings: Finding[],
  knownFindings: Finding[],
  resolved: string[],
  filePath: string,
  minSeverity: Severity,
): void {
  const lines: string[] = []
  lines.push('# Security scan summary', '')
  lines.push(`_Generated: ${new Date().toISOString()}_`, '')

  // ── Stats table ─────────────────────────────────────────────────────────────
  const sevOrder = [
    Severity.CRITICAL,
    Severity.HIGH,
    Severity.MEDIUM,
    Severity.LOW,
    Severity.INFO,
    Severity.UNKNOWN,
  ]
  const buckets: Record<number, { new: number; known: number }> = {}
  for (const sev of sevOrder) buckets[sev] = { new: 0, known: 0 }
  for (const f of newFindings) (buckets[f.severity] ??= { new: 0, known: 0 }).new++
  for (const f of knownFindings) (buckets[f.severity] ??= { new: 0, known: 0 }).known++

  lines.push('| Severity | New | Known (baseline) |', '| --- | --- | --- |')
  for (const sev of sevOrder) {
    const b = buckets[sev] ?? { new: 0, known: 0 }
    if (sev === Severity.UNKNOWN && b.new + b.known === 0) continue
    lines.push(`| ${SEV_LABEL[sev]} | ${b.new} | ${b.known} |`)
  }
  lines.push(`| **Resolved** | ${resolved.length} | — |`, '')
  lines.push(
    'The table below lists **new findings** only (not present in the baseline). ' +
      'Run `dude security accept` to absorb triaged findings into the baseline.',
    '',
  )

  // ── New findings detail ──────────────────────────────────────────────────────
  const actionable = newFindings
    .filter((f) => f.severity >= minSeverity)
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        a.component.localeCompare(b.component) ||
        a.file.localeCompare(b.file),
    )

  if (actionable.length === 0) {
    lines.push(`No new findings at severity ≥ ${SEV_LABEL[minSeverity]}.`)
  } else {
    lines.push(`## New findings (severity ≥ ${SEV_LABEL[minSeverity]})`, '')
    const CTX_KEYS = [
      'package',
      'installed_version',
      'fixed_version',
      'cwe',
      'owasp',
      'primary_url',
    ]
    for (const f of actionable) {
      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '—'
      lines.push(`### [${SEV_LABEL[f.severity]}] ${f.title}`)
      lines.push(`- **Tool**: ${f.tool}  **Rule**: \`${f.ruleId}\`  **Component**: ${f.component}`)
      lines.push(`- **Location**: ${loc}`)
      if (f.message) lines.push(`- **Message**: ${truncate(f.message)}`)
      for (const k of CTX_KEYS) {
        if (f.extra[k]) lines.push(`- **${k}**: ${f.extra[k]}`)
      }
      lines.push('')
    }
  }

  // ── Resolved ────────────────────────────────────────────────────────────────
  if (resolved.length > 0) {
    lines.push(
      '',
      `## Resolved since last baseline (${resolved.length})`,
      '',
      'The following baseline fingerprints are no longer produced by the current scan.',
      'Run `dude security accept` to prune them.',
      '',
    )
    for (const fp of resolved.slice(0, 50)) lines.push(`- \`${fp}\``)
    if (resolved.length > 50) lines.push(`- … and ${resolved.length - 50} more`)
  }

  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, lines.join('\n').trimEnd() + '\n')
}

// ── Runner ─────────────────────────────────────────────────────────────────────

interface RunConfig {
  projectRoot: string
  reportsRoot: string
  baselinePath: string
  adapterNames: string[]
  minSeverity: Severity
  failOn: Severity
  updateBaseline: boolean
}

interface RunResult {
  findings: Finding[]
  newFindings: Finding[]
  knownFindings: Finding[]
  resolved: string[]
  runDir: string
  latestDir: string
  exitCode: number
}

function runScan(config: RunConfig): RunResult {
  ensureDocker()

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const timestamp =
    `${now.getUTCFullYear()}` +
    `${pad(now.getUTCMonth() + 1)}` +
    `${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}` +
    `${pad(now.getUTCMinutes())}` +
    `${pad(now.getUTCSeconds())}Z`

  const runDir = path.join(config.reportsRoot, timestamp)
  const latestDir = path.join(config.reportsRoot, 'latest')
  mkdirSync(runDir, { recursive: true })

  const cachePrefix = path.basename(config.projectRoot)
  const opts: AdapterOpts = { cachePrefix }
  const findings: Finding[] = []

  for (const name of config.adapterNames) {
    const adapter = ALL_ADAPTERS[name]
    if (!adapter) {
      process.stderr.write(
        `[security] unknown adapter: ${name}. Available: ${Object.keys(ALL_ADAPTERS).join(', ')}\n`,
      )
      continue
    }

    const cmd = adapter.buildCommand(config.projectRoot, runDir, opts)
    const [bin, ...cmdArgs] = cmd
    process.stderr.write(`[security] running ${name}: ${cmd.join(' ')}\n`)

    const result = spawnSync(bin ?? 'docker', cmdArgs, {
      cwd: config.projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const reportPath = path.join(runDir, `${name}.json`)
    if (!existsSync(reportPath)) {
      const stdout = (result.stdout as Buffer | null)?.toString() ?? ''
      const stderr = (result.stderr as Buffer | null)?.toString() ?? ''
      process.stderr.write(
        `[security] WARNING: ${name} produced no report (exit=${result.status ?? 'null'}).\n` +
          `  stdout: ${stdout.slice(0, 400)}\n` +
          `  stderr: ${stderr.slice(0, 400)}\n`,
      )
      continue
    }

    try {
      const data = JSON.parse(readFileSync(reportPath, 'utf8') || '{}') as unknown
      findings.push(...adapter.parse(data))
    } catch (err) {
      process.stderr.write(`[security] ${name}: invalid JSON (${String(err)})\n`)
    }
  }

  // ── Classify against baseline ────────────────────────────────────────────────
  const baseline = Baseline.load(config.baselinePath)
  const { newFindings, knownFindings, resolved } = baseline.classify(findings)

  // ── Write reports ────────────────────────────────────────────────────────────
  writeFindingsJson(findings, path.join(runDir, 'findings.json'))
  writeFindingsJson(newFindings, path.join(runDir, 'findings.new.json'))
  writeMarkdownSummary(
    newFindings,
    knownFindings,
    resolved,
    path.join(runDir, 'summary.md'),
    config.minSeverity,
  )

  // ── Refresh latest/ ──────────────────────────────────────────────────────────
  if (existsSync(latestDir)) rmSync(latestDir, { recursive: true, force: true })
  cpSync(runDir, latestDir, { recursive: true })

  // ── Update baseline if requested ────────────────────────────────────────────
  if (config.updateBaseline) {
    baseline.updateFrom(findings)
    for (const fp of resolved) baseline.entries.delete(fp)
    baseline.save(config.baselinePath)
  }

  const blockingCount = newFindings.filter((f) => f.severity >= config.failOn).length
  return {
    findings,
    newFindings,
    knownFindings,
    resolved,
    runDir,
    latestDir,
    exitCode: blockingCount > 0 ? 1 : 0,
  }
}

// ── Commands ───────────────────────────────────────────────────────────────────

const ADAPTER_CHOICES = Object.keys(ALL_ADAPTERS).join(', ')
const SEV_CHOICES = 'INFO, LOW, MEDIUM, HIGH, CRITICAL'

/** `dude security scan` */
export const securityScanCommand: StackCommandDef = {
  description:
    'Run SAST scanners (Bandit, Semgrep, Trivy FS, Trivy Image) and produce a findings summary.',
  args: {
    only: {
      type: 'string',
      description: `Comma-separated subset of adapters to run (choices: ${ADAPTER_CHOICES}). Default: all.`,
    },
    'min-severity': {
      type: 'string',
      description: `Lowest severity shown in the Markdown summary (${SEV_CHOICES}). Default: MEDIUM.`,
      default: 'MEDIUM',
    },
    'fail-on': {
      type: 'string',
      description: `Exit non-zero when a new finding at this severity or above exists (${SEV_CHOICES}). Default: HIGH.`,
      default: 'HIGH',
    },
    'update-baseline': {
      type: 'boolean',
      description: 'Absorb every current finding into the baseline.',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const reportsRoot = path.join(projectRoot, 'private', 'sast-reports')
    const baselinePath = path.join(projectRoot, 'security', 'baseline.json')

    section('security scan')

    const result = runScan({
      projectRoot,
      reportsRoot,
      baselinePath,
      adapterNames: parseAdapters(args['only'] as string | undefined),
      minSeverity: parseSeverityArg(args['min-severity'] as string | undefined, Severity.MEDIUM),
      failOn: parseSeverityArg(args['fail-on'] as string | undefined, Severity.HIGH),
      updateBaseline: Boolean(args['update-baseline']),
    })

    process.stderr.write(
      `[security] done. run_dir=${result.runDir} ` +
        `total=${result.findings.length} new=${result.newFindings.length} ` +
        `known=${result.knownFindings.length} resolved=${result.resolved.length}\n`,
    )

    const summaryPath = path.join(result.latestDir, 'summary.md')
    if (existsSync(summaryPath)) {
      process.stdout.write(readFileSync(summaryPath, 'utf8'))
    }

    if (result.exitCode !== 0) process.exit(result.exitCode)
  },
}

/** `dude security accept` — alias for `scan --update-baseline` */
export const securityAcceptCommand: StackCommandDef = {
  description:
    'Re-scan and absorb all current findings into the baseline. ' +
    'Use after triaging to silence known findings on subsequent scans.',
  args: {
    only: {
      type: 'string',
      description: `Comma-separated subset of adapters to run (choices: ${ADAPTER_CHOICES}). Default: all.`,
    },
  },
  async run({ projectRoot, args }) {
    const reportsRoot = path.join(projectRoot, 'private', 'sast-reports')
    const baselinePath = path.join(projectRoot, 'security', 'baseline.json')

    section('security accept')

    const result = runScan({
      projectRoot,
      reportsRoot,
      baselinePath,
      adapterNames: parseAdapters(args['only'] as string | undefined),
      minSeverity: Severity.MEDIUM,
      failOn: Severity.HIGH,
      updateBaseline: true,
    })

    process.stderr.write(
      `[security] done. Baseline updated with ${result.findings.length} finding(s).\n`,
    )
    process.stdout.write(`Baseline saved to ${baselinePath}.\nReview and commit the change.\n`)
  },
}

/** `dude security verify` */
export const securityVerifyCommand: StackCommandDef = {
  description:
    'Re-scan and check whether specific findings have been resolved. ' +
    'A finding is resolved when it was in the baseline but absent from the current scan.',
  args: {
    'rule-id': {
      type: 'string',
      description:
        'Comma-separated rule identifiers to verify (e.g. B105,CVE-2026-33750). ' +
        'Omit to report on all resolved/unresolved baseline entries.',
    },
    only: {
      type: 'string',
      description: `Comma-separated subset of adapters to run (choices: ${ADAPTER_CHOICES}). Default: all.`,
    },
    'remove-resolved': {
      type: 'boolean',
      description: 'Remove resolved findings from the baseline file after confirming the fix.',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const reportsRoot = path.join(projectRoot, 'private', 'sast-reports')
    const baselinePath = path.join(projectRoot, 'security', 'baseline.json')
    const isTTY = process.stdout.isTTY

    section('security verify')

    const result = runScan({
      projectRoot,
      reportsRoot,
      baselinePath,
      adapterNames: parseAdapters(args['only'] as string | undefined),
      minSeverity: Severity.MEDIUM,
      failOn: Severity.HIGH,
      updateBaseline: false,
    })

    const baseline = Baseline.load(baselinePath)
    const { newFindings, knownFindings, resolved } = baseline.classify(result.findings)

    const ruleIdArg = args['rule-id'] as string | undefined
    const ruleIds = ruleIdArg
      ? ruleIdArg
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    function matches(candidate: string, ruleId: string): boolean {
      return ruleId === candidate || candidate.includes(ruleId)
    }

    let allFixed = true

    if (ruleIds.length === 0) {
      // No filter — report overall stats
      process.stdout.write(`\nResolved fingerprints : ${resolved.length}\n`)
      process.stdout.write(`Still present (known) : ${knownFindings.length}\n`)
      process.stdout.write(`New (not in baseline) : ${newFindings.length}\n`)
      allFixed = resolved.length > 0 && knownFindings.length === 0
    } else {
      for (const ruleId of ruleIds) {
        const ruleResolved = resolved.filter((fp) =>
          matches(baseline.entries.get(fp)?.ruleId ?? '', ruleId),
        )
        const ruleStillPresent = knownFindings.filter((f) => matches(f.ruleId, ruleId))
        const isFixed = ruleResolved.length > 0 && ruleStillPresent.length === 0
        allFixed = allFixed && isFixed

        const badge = isFixed
          ? isTTY
            ? '\x1b[32m✓ RESOLVED\x1b[0m'
            : '✓ RESOLVED'
          : isTTY
            ? '\x1b[31m✗ STILL PRESENT\x1b[0m'
            : '✗ STILL PRESENT'

        process.stdout.write(`\n[${ruleId}] ${badge}\n`)

        if (ruleResolved.length > 0) {
          process.stdout.write(`  Resolved fingerprints: ${ruleResolved.join(', ')}\n`)
        }
        if (ruleStillPresent.length > 0) {
          process.stdout.write(`  Still present (${ruleStillPresent.length} finding(s)):\n`)
          for (const f of ruleStillPresent) {
            const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '—'
            process.stdout.write(`    - ${loc} — ${f.title}\n`)
          }
        }
      }
    }

    // ── Remove resolved from baseline ──────────────────────────────────────────
    if (Boolean(args['remove-resolved']) && resolved.length > 0) {
      const toRemove =
        ruleIds.length === 0
          ? resolved
          : resolved.filter((fp) =>
              ruleIds.some((rid) => matches(baseline.entries.get(fp)?.ruleId ?? '', rid)),
            )

      if (toRemove.length > 0) {
        const fresh = Baseline.load(baselinePath)
        for (const fp of toRemove) fresh.entries.delete(fp)
        fresh.save(baselinePath)
        process.stdout.write(
          `\nBaseline updated: ${toRemove.length} entry/entries removed from ${baselinePath}.\n` +
            'Review and commit the change.\n',
        )
      }
    }

    if (!allFixed) process.exit(1)
  },
}
