import { describe, it, expect, afterEach } from 'vitest'
import {
  banditAdapter,
  semgrepAdapter,
  trivyFsAdapter,
  trivyImageAdapter,
  ALL_ADAPTERS,
  DEFAULT_ADAPTERS,
} from './adapters'
import { Severity } from './models'

const OPTS = { cachePrefix: 'myproj' }

describe('adapter registry', () => {
  it('ALL_ADAPTERS maps names to adapters with matching .name', () => {
    for (const [key, adapter] of Object.entries(ALL_ADAPTERS)) {
      expect(adapter.name).toBe(key)
    }
  })

  it('DEFAULT_ADAPTERS are all present in the registry', () => {
    for (const name of DEFAULT_ADAPTERS) {
      expect(ALL_ADAPTERS).toHaveProperty(name)
    }
  })
})

describe('banditAdapter.parse', () => {
  it('returns [] for non-object / missing results', () => {
    expect(banditAdapter.parse(null)).toEqual([])
    expect(banditAdapter.parse({})).toEqual([])
    expect(banditAdapter.parse({ results: 'nope' })).toEqual([])
  })

  it('maps a bandit result into a Finding', () => {
    const findings = banditAdapter.parse({
      results: [
        {
          filename: './backend/app/main.py',
          issue_severity: 'HIGH',
          issue_confidence: 'MEDIUM',
          test_id: 'B101',
          test_name: 'assert_used',
          issue_text: 'Use of assert detected.',
          line_number: 42,
          issue_cwe: { id: 703 },
          more_info: 'https://example.com',
        },
      ],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      tool: 'bandit',
      ruleId: 'B101',
      severity: Severity.HIGH,
      title: 'assert_used',
      file: 'backend/app/main.py', // leading ./ stripped
      line: 42,
      component: 'backend',
    })
    expect(findings[0]!.extra).toMatchObject({ confidence: 'MEDIUM', cwe: '703' })
  })

  it('classifies non-backend files as repo component', () => {
    const findings = banditAdapter.parse({
      results: [{ filename: 'scripts/tool.py', issue_severity: 'LOW', test_id: 'B102' }],
    })
    expect(findings[0]!.component).toBe('repo')
    expect(findings[0]!.severity).toBe(Severity.LOW)
  })
})

describe('semgrepAdapter.parse', () => {
  it('maps a semgrep result, deriving title from shortlink', () => {
    const findings = semgrepAdapter.parse({
      results: [
        {
          check_id: 'python.lang.security.audit.foo',
          path: 'backend/app/x.py',
          start: { line: 7 },
          extra: {
            severity: 'ERROR',
            message: '  dangerous thing  ',
            metadata: {
              shortlink: 'https://sg.run/abcd',
              cwe: ['CWE-79'],
              owasp: ['A03'],
              category: 'security',
            },
          },
        },
      ],
    })
    expect(findings[0]).toMatchObject({
      tool: 'semgrep',
      severity: Severity.HIGH,
      title: 'abcd',
      message: 'dangerous thing',
      file: 'backend/app/x.py',
      line: 7,
      component: 'backend',
    })
    expect(findings[0]!.extra).toMatchObject({ cwe: 'CWE-79', owasp: 'A03', category: 'security' })
  })

  it('falls back to check_id when no shortlink and maps WARNING→MEDIUM', () => {
    const findings = semgrepAdapter.parse({
      results: [
        {
          check_id: 'my.rule',
          path: 'frontend/src/App.tsx',
          extra: { severity: 'WARNING', metadata: {} },
        },
      ],
    })
    expect(findings[0]!.title).toBe('my.rule')
    expect(findings[0]!.severity).toBe(Severity.MEDIUM)
    expect(findings[0]!.component).toBe('frontend')
  })
})

describe('trivyFsAdapter.parse', () => {
  it('extracts vulnerabilities, misconfigurations, and secrets', () => {
    const findings = trivyFsAdapter.parse({
      Results: [
        {
          Target: 'backend/requirements.txt',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2024-1',
              PkgName: 'requests',
              InstalledVersion: '2.0.0',
              FixedVersion: '2.0.1',
              Severity: 'CRITICAL',
              Title: 'bad bug',
            },
          ],
        },
        {
          Target: 'Dockerfile',
          Misconfigurations: [
            {
              ID: 'DS002',
              Severity: 'HIGH',
              Title: 'root user',
              Description: 'runs as root',
              CauseMetadata: { StartLine: 3 },
            },
          ],
          Secrets: [
            {
              RuleID: 'aws-key',
              Severity: 'CRITICAL',
              Title: 'AWS key',
              Match: 'AKIA...',
              StartLine: 9,
              Category: 'AWS',
            },
          ],
        },
      ],
    })

    expect(findings).toHaveLength(3)
    const vuln = findings.find((f) => f.ruleId === 'CVE-2024-1')!
    expect(vuln).toMatchObject({ severity: Severity.CRITICAL, component: 'backend', line: 0 })
    expect(vuln.title).toBe('CVE-2024-1 in requests 2.0.0')
    expect(vuln.extra).toMatchObject({ package: 'requests', fixed_version: '2.0.1' })

    const misconfig = findings.find((f) => f.ruleId === 'DS002')!
    expect(misconfig).toMatchObject({ severity: Severity.HIGH, component: 'docker', line: 3 })

    const secret = findings.find((f) => f.ruleId === 'aws-key')!
    expect(secret).toMatchObject({ severity: Severity.CRITICAL, line: 9 })
    expect(secret.extra).toMatchObject({ category: 'AWS' })
  })

  it('returns [] when Results is absent', () => {
    expect(trivyFsAdapter.parse({})).toEqual([])
    expect(trivyFsAdapter.parse(null)).toEqual([])
  })
})

describe('trivyImageAdapter.parse', () => {
  it('extracts image vulnerabilities', () => {
    const findings = trivyImageAdapter.parse({
      Results: [
        {
          Target: 'myproj-web:latest',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2024-9',
              PkgName: 'openssl',
              InstalledVersion: '1.1',
              Severity: 'MEDIUM',
            },
          ],
        },
      ],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      tool: 'trivy-image',
      ruleId: 'CVE-2024-9',
      severity: Severity.MEDIUM,
    })
  })
})

describe('buildCommand', () => {
  const ROOT = '/abs/project'
  const RUN = '/abs/project/.dude/sec-run'

  it('bandit mounts the project and writes an in-container report path', () => {
    const cmd = banditAdapter.buildCommand(ROOT, RUN, OPTS)
    expect(cmd[0]).toBe('docker')
    expect(cmd).toContain(`${ROOT}:/src`)
    expect(cmd.join(' ')).toContain('/src/.dude/sec-run/bandit.json')
  })

  it('trivy-fs skips noisy dirs and outputs JSON', () => {
    const cmd = trivyFsAdapter.buildCommand(ROOT, RUN, OPTS)
    expect(cmd).toContain('--skip-dirs')
    expect(cmd.join(' ')).toContain('node_modules,private')
    expect(cmd).toContain('json')
  })

  describe('trivy-image target image resolution', () => {
    const ENV = 'TRIVY_TARGET_IMAGE'
    const original = process.env[ENV]
    afterEach(() => {
      if (original === undefined) delete process.env[ENV]
      else process.env[ENV] = original
    })

    it('uses explicit opts.targetImage first', () => {
      const cmd = trivyImageAdapter.buildCommand(ROOT, RUN, { ...OPTS, targetImage: 'custom:tag' })
      expect(cmd).toContain('custom:tag')
    })

    it('falls back to TRIVY_TARGET_IMAGE env var', () => {
      process.env[ENV] = 'env-image:v1'
      const cmd = trivyImageAdapter.buildCommand(ROOT, RUN, OPTS)
      expect(cmd).toContain('env-image:v1')
    })

    it('defaults to <cachePrefix>-web:latest', () => {
      delete process.env[ENV]
      const cmd = trivyImageAdapter.buildCommand(ROOT, RUN, OPTS)
      expect(cmd).toContain('myproj-web:latest')
    })
  })
})
