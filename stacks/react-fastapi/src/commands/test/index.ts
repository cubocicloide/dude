import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

function isAvailable(cmd: string): boolean {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
  return r.error == null
}

function exec(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): boolean {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
  return r.status === 0 && r.error == null
}

function section(title: string) {
  const isTTY = process.stdout.isTTY
  const line = '─'.repeat(Math.max(0, 52 - title.length))
  const header = `── ${title} ${line}`
  process.stdout.write(isTTY ? `\n\x1b[1m${header}\x1b[0m\n` : `\n${header}\n`)
}

export const testCommand: StackCommandDef = {
  description:
    'Run tests: pytest for the backend and/or Playwright+Cucumber for e2e. ' +
    'When no filter flag is given all available suites are run.',
  args: {
    backend: {
      type: 'boolean',
      description: 'Run backend unit/integration tests (pytest).',
      default: false,
    },
    e2e: {
      type: 'boolean',
      description: 'Run end-to-end tests (Playwright + Cucumber.js).',
      default: false,
    },
    headed: {
      type: 'boolean',
      description: 'Run e2e tests in a visible browser window (sets HEADED=true).',
      default: false,
    },
    report: {
      type: 'boolean',
      description: 'Generate HTML and JSON reports for e2e tests (written to e2e/reports/).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const backendDir = path.join(projectRoot, 'backend')
    const e2eDir = path.join(projectRoot, 'e2e')

    const flagBackend = Boolean(args.backend)
    const flagE2e = Boolean(args.e2e)
    const headed = Boolean(args.headed)
    const report = Boolean(args.report)

    // When no explicit suite is selected, run all suites that are present.
    const runAll = !flagBackend && !flagE2e
    const runBackend = flagBackend || runAll
    const runE2e = flagE2e || runAll

    const hasBackend = existsSync(backendDir)
    const hasE2e = existsSync(e2eDir)

    // ── Preflight ─────────────────────────────────────────────────────────────
    const missing: string[] = []
    if (runBackend && hasBackend && !isAvailable('uv'))
      missing.push('uv  →  https://docs.astral.sh/uv/getting-started/installation/')
    if (runE2e && hasE2e && !isAvailable('pnpm'))
      missing.push('pnpm  →  https://pnpm.io/installation')

    if (missing.length > 0) {
      process.stderr.write(
        'error: the following tools are required but were not found on your PATH:\n\n',
      )
      for (const m of missing) process.stderr.write(`  • ${m}\n`)
      process.stderr.write('\n')
      process.exit(1)
    }

    // Warn when a requested suite has no matching directory.
    if (runBackend && !hasBackend)
      process.stderr.write(
        'warn: --backend requested but backend/ directory not found, skipping.\n',
      )
    if (runE2e && !hasE2e)
      process.stderr.write('warn: --e2e requested but e2e/ directory not found, skipping.\n')

    let ok = true

    // ── Backend: pytest ───────────────────────────────────────────────────────
    if (runBackend && hasBackend) {
      section('pytest')
      ok = exec('uv', ['run', 'pytest'], backendDir) && ok
    }

    // ── E2E: Playwright + Cucumber.js ─────────────────────────────────────────
    if (runE2e && hasE2e) {
      const script = report ? 'test:report' : 'test'
      section(`cucumber${headed ? ' (headed)' : ''}${report ? ' + report' : ''}`)
      ok = exec('pnpm', ['run', script], e2eDir, headed ? { HEADED: 'true' } : undefined) && ok
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const isTTY = process.stdout.isTTY
    process.stdout.write('\n')
    if (ok) {
      process.stdout.write(isTTY ? '\x1b[32mAll tests passed.\x1b[0m\n' : 'All tests passed.\n')
    } else {
      process.stderr.write(isTTY ? '\x1b[31mTests failed.\x1b[0m\n' : 'Tests failed.\n')
      process.exit(1)
    }
  },
}
