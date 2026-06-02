import path from 'pathe'
import { type Finding, Severity, parseSeverity } from './models.js'

// ── Adapter interface ──────────────────────────────────────────────────────────

export interface AdapterOpts {
  /** Used as a prefix for Docker named volumes (e.g. the project directory name). */
  cachePrefix: string
  /** Override the Docker image tag for `trivy-image`. Defaults to `<cachePrefix>-web:latest`. */
  targetImage?: string
}

export interface Adapter {
  name: string
  buildCommand(projectRoot: string, runDir: string, opts: AdapterOpts): string[]
  parse(data: unknown): Finding[]
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function reportInContainer(projectRoot: string, runDir: string, name: string): string {
  return `/src/${path.relative(projectRoot, path.join(runDir, `${name}.json`))}`
}

// ── Bandit ────────────────────────────────────────────────────────────────────

const BANDIT_SEV: Record<string, Severity> = {
  UNDEFINED: Severity.UNKNOWN,
  LOW: Severity.LOW,
  MEDIUM: Severity.MEDIUM,
  HIGH: Severity.HIGH,
}

function banditComponent(filePath: string): string {
  return filePath.startsWith('backend/') ? 'backend' : 'repo'
}

export const banditAdapter: Adapter = {
  name: 'bandit',
  buildCommand(projectRoot, runDir, opts) {
    const report = reportInContainer(projectRoot, runDir, 'bandit')
    const banditCmd =
      'pip install --quiet --disable-pip-version-check bandit[toml]==1.7.9 && ' +
      `bandit -r backend -f json -o ${report} ` +
      "--exclude 'backend/tests'"
    return [
      'docker', 'run', '--rm',
      '-v', `${projectRoot}:/src`,
      '-v', `${opts.cachePrefix}-pip-cache:/root/.cache/pip`,
      '-w', '/src',
      'python:3.12-slim',
      'sh', '-c', banditCmd,
    ]
  },
  parse(data) {
    if (typeof data !== 'object' || data === null) return []
    const results = (data as Record<string, unknown>)['results']
    if (!Array.isArray(results)) return []
    const findings: Finding[] = []
    for (const item of results) {
      if (typeof item !== 'object' || item === null) continue
      const r = item as Record<string, unknown>
      const filePath = String(r['filename'] ?? '').replace(/^\.\//, '')
      const sevKey = String(r['issue_severity'] ?? '').toUpperCase()
      const ruleId = String(r['test_id'] ?? 'BANDIT')
      const cweObj = r['issue_cwe'] as Record<string, unknown> | null | undefined
      findings.push({
        tool: 'bandit',
        ruleId,
        severity: BANDIT_SEV[sevKey] ?? Severity.UNKNOWN,
        title: String(r['test_name'] ?? ruleId),
        message: String(r['issue_text'] ?? ''),
        file: filePath,
        line: Number(r['line_number'] ?? 0) || 0,
        component: banditComponent(filePath),
        extra: {
          confidence: String(r['issue_confidence'] ?? ''),
          cwe: String(cweObj?.['id'] ?? ''),
          more_info: String(r['more_info'] ?? ''),
        },
      })
    }
    return findings
  },
}

// ── Semgrep ───────────────────────────────────────────────────────────────────

const SEMGREP_IMAGE = 'returntocorp/semgrep:1.86.0'

// Curated rulesets for the React + FastAPI stack (no django).
const SEMGREP_CONFIGS = [
  'p/security-audit',
  'p/python',
  'p/javascript',
  'p/typescript',
  'p/react',
  'p/dockerfile',
]

const SEMGREP_SEV: Record<string, Severity> = {
  INFO: Severity.INFO,
  WARNING: Severity.MEDIUM,
  ERROR: Severity.HIGH,
}

function semgrepComponent(filePath: string): string {
  if (filePath.startsWith('backend/')) return 'backend'
  if (filePath.startsWith('frontend/')) return 'frontend'
  if (filePath.endsWith('Dockerfile') || filePath.includes('docker-compose')) return 'docker'
  return 'repo'
}

export const semgrepAdapter: Adapter = {
  name: 'semgrep',
  buildCommand(projectRoot, runDir, _opts) {
    const report = reportInContainer(projectRoot, runDir, 'semgrep')
    const cmd = [
      'docker', 'run', '--rm',
      '-v', `${projectRoot}:/src`,
      '-w', '/src',
      SEMGREP_IMAGE,
      'semgrep', 'scan',
      '--json', '--output', report,
      '--error',
      '--exclude', 'node_modules',
      '--exclude', 'staticfiles',
      '--exclude', 'private',
      '--exclude', 'e2e/reports',
      '--exclude', '.venv',
      '--exclude', 'migrations',
    ]
    for (const cfg of SEMGREP_CONFIGS) {
      cmd.push('--config', cfg)
    }
    cmd.push('backend', 'frontend/src')
    return cmd
  },
  parse(data) {
    if (typeof data !== 'object' || data === null) return []
    const results = (data as Record<string, unknown>)['results']
    if (!Array.isArray(results)) return []
    const findings: Finding[] = []
    for (const item of results) {
      if (typeof item !== 'object' || item === null) continue
      const r = item as Record<string, unknown>
      const extra = (r['extra'] as Record<string, unknown>) ?? {}
      const metadata = (extra['metadata'] as Record<string, unknown>) ?? {}
      const rawSev = String(extra['severity'] ?? '').toUpperCase()
      const filePath = String(r['path'] ?? '')
      const checkId = String(r['check_id'] ?? 'SEMGREP')
      const shortlink = String(metadata['shortlink'] ?? '')
      const title = (shortlink ? (shortlink.split('/').at(-1) ?? '') : '') || checkId
      const cwe = metadata['cwe']
      const owasp = metadata['owasp']
      const start = r['start'] as Record<string, unknown> | undefined
      findings.push({
        tool: 'semgrep',
        ruleId: checkId,
        severity: SEMGREP_SEV[rawSev] ?? Severity.UNKNOWN,
        title,
        message: String(extra['message'] ?? '').trim(),
        file: filePath,
        line: Number(start?.['line'] ?? 0) || 0,
        component: semgrepComponent(filePath),
        extra: {
          cwe: Array.isArray(cwe) ? cwe.join(',') : '',
          owasp: Array.isArray(owasp) ? owasp.join(',') : '',
          category: String(metadata['category'] ?? ''),
        },
      })
    }
    return findings
  },
}

// ── Trivy (shared) ────────────────────────────────────────────────────────────

const TRIVY_IMAGE = 'aquasec/trivy:0.52.2'

const TRIVY_SEV: Record<string, Severity> = {
  UNKNOWN: Severity.UNKNOWN,
  LOW: Severity.LOW,
  MEDIUM: Severity.MEDIUM,
  HIGH: Severity.HIGH,
  CRITICAL: Severity.CRITICAL,
}

function trivyComponent(filePath: string): string {
  if (filePath.startsWith('backend/')) return 'backend'
  if (filePath.startsWith('frontend/')) return 'frontend'
  if (filePath.endsWith('Dockerfile') || filePath.includes('docker-compose')) return 'docker'
  return 'deps'
}

// ── Trivy FS ──────────────────────────────────────────────────────────────────

export const trivyFsAdapter: Adapter = {
  name: 'trivy-fs',
  buildCommand(projectRoot, runDir, opts) {
    const report = reportInContainer(projectRoot, runDir, 'trivy-fs')
    return [
      'docker', 'run', '--rm',
      '-v', `${projectRoot}:/src`,
      '-v', `${opts.cachePrefix}-trivy-cache:/root/.cache/`,
      '-w', '/src',
      TRIVY_IMAGE,
      'fs',
      '--scanners', 'vuln,misconfig,secret',
      '--format', 'json',
      '--output', report,
      '--skip-dirs', 'node_modules,private,staticfiles,e2e/reports,.venv',
      '.',
    ]
  },
  parse(data) {
    if (typeof data !== 'object' || data === null) return []
    const results = (data as Record<string, unknown>)['Results']
    if (!Array.isArray(results)) return []
    const findings: Finding[] = []

    for (const item of results) {
      if (typeof item !== 'object' || item === null) continue
      const r = item as Record<string, unknown>
      const target = String(r['Target'] ?? '')

      for (const v of (Array.isArray(r['Vulnerabilities']) ? r['Vulnerabilities'] : [])) {
        if (typeof v !== 'object' || v === null) continue
        const vr = v as Record<string, unknown>
        const ruleId = String(vr['VulnerabilityID'] ?? 'CVE-UNKNOWN')
        const pkg = String(vr['PkgName'] ?? '')
        const installed = String(vr['InstalledVersion'] ?? '')
        findings.push({
          tool: 'trivy-fs',
          ruleId,
          severity: TRIVY_SEV[String(vr['Severity'] ?? '').toUpperCase()] ?? Severity.UNKNOWN,
          title: `${ruleId} in ${pkg} ${installed}`.trim(),
          message: String(vr['Title'] ?? vr['Description'] ?? '').trim(),
          file: target,
          line: 0,
          component: trivyComponent(target),
          extra: {
            package: pkg,
            installed_version: installed,
            fixed_version: String(vr['FixedVersion'] ?? ''),
            primary_url: String(vr['PrimaryURL'] ?? ''),
          },
        })
      }

      for (const m of (Array.isArray(r['Misconfigurations']) ? r['Misconfigurations'] : [])) {
        if (typeof m !== 'object' || m === null) continue
        const mr = m as Record<string, unknown>
        const cause = (mr['CauseMetadata'] as Record<string, unknown>) ?? {}
        const ruleId = String(mr['ID'] ?? 'MISCONFIG')
        findings.push({
          tool: 'trivy-fs',
          ruleId,
          severity: TRIVY_SEV[String(mr['Severity'] ?? '').toUpperCase()] ?? Severity.UNKNOWN,
          title: String(mr['Title'] ?? ruleId),
          message: String(mr['Description'] ?? '').trim(),
          file: target,
          line: Number(cause['StartLine'] ?? 0) || 0,
          component: trivyComponent(target),
          extra: {
            resolution: String(mr['Resolution'] ?? ''),
            primary_url: String(mr['PrimaryURL'] ?? ''),
            service: String(mr['Type'] ?? ''),
          },
        })
      }

      for (const s of (Array.isArray(r['Secrets']) ? r['Secrets'] : [])) {
        if (typeof s !== 'object' || s === null) continue
        const sr = s as Record<string, unknown>
        const ruleId = String(sr['RuleID'] ?? 'SECRET')
        findings.push({
          tool: 'trivy-fs',
          ruleId,
          severity: TRIVY_SEV[String(sr['Severity'] ?? '').toUpperCase()] ?? Severity.HIGH,
          title: String(sr['Title'] ?? ruleId),
          message: String(sr['Match'] ?? '').trim(),
          file: target,
          line: Number(sr['StartLine'] ?? 0) || 0,
          component: trivyComponent(target),
          extra: { category: String(sr['Category'] ?? '') },
        })
      }
    }
    return findings
  },
}

// ── Trivy Image ───────────────────────────────────────────────────────────────

export const trivyImageAdapter: Adapter = {
  name: 'trivy-image',
  buildCommand(projectRoot, runDir, opts) {
    const report = reportInContainer(projectRoot, runDir, 'trivy-image')
    const targetImage =
      opts.targetImage ?? process.env['TRIVY_TARGET_IMAGE'] ?? `${opts.cachePrefix}-web:latest`
    return [
      'docker', 'run', '--rm',
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-v', `${projectRoot}:/src`,
      '-v', `${opts.cachePrefix}-trivy-cache:/root/.cache/`,
      TRIVY_IMAGE,
      'image',
      '--format', 'json',
      '--output', report,
      '--severity', 'MEDIUM,HIGH,CRITICAL',
      targetImage,
    ]
  },
  parse(data) {
    if (typeof data !== 'object' || data === null) return []
    const results = (data as Record<string, unknown>)['Results']
    if (!Array.isArray(results)) return []
    const findings: Finding[] = []
    for (const item of results) {
      if (typeof item !== 'object' || item === null) continue
      const r = item as Record<string, unknown>
      const target = String(r['Target'] ?? '')
      for (const v of (Array.isArray(r['Vulnerabilities']) ? r['Vulnerabilities'] : [])) {
        if (typeof v !== 'object' || v === null) continue
        const vr = v as Record<string, unknown>
        const ruleId = String(vr['VulnerabilityID'] ?? 'CVE-UNKNOWN')
        const pkg = String(vr['PkgName'] ?? '')
        const installed = String(vr['InstalledVersion'] ?? '')
        findings.push({
          tool: 'trivy-image',
          ruleId,
          severity: TRIVY_SEV[String(vr['Severity'] ?? '').toUpperCase()] ?? Severity.UNKNOWN,
          title: `${ruleId} in ${pkg} ${installed}`.trim(),
          message: String(vr['Title'] ?? vr['Description'] ?? '').trim(),
          file: target,
          line: 0,
          component: trivyComponent(target),
          extra: {
            package: pkg,
            installed_version: installed,
            fixed_version: String(vr['FixedVersion'] ?? ''),
            primary_url: String(vr['PrimaryURL'] ?? ''),
          },
        })
      }
    }
    return findings
  },
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const ALL_ADAPTERS: Record<string, Adapter> = {
  bandit: banditAdapter,
  semgrep: semgrepAdapter,
  'trivy-fs': trivyFsAdapter,
  'trivy-image': trivyImageAdapter,
}

export const DEFAULT_ADAPTERS = ['bandit', 'semgrep', 'trivy-fs', 'trivy-image']

// Re-export for convenience
export { parseSeverity }
