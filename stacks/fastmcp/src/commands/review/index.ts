import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import { runLint, formatDiagnostic, type StackCommandDef } from '@cubocicloide/dude'

function isAvailable(cmd: string): boolean {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
  return r.error == null
}

function exec(cmd: string, args: string[], cwd: string): boolean {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  return r.status === 0 && r.error == null
}

function ensureVenv(dir: string): boolean {
  const venvRuff = path.join(dir, '.venv', 'bin', 'ruff')
  if (existsSync(venvRuff)) return true
  process.stdout.write('.venv not found — running uv sync…\n')
  return exec('uv', ['sync'], dir)
}

function isDockerServiceRunning(service: string, cwd: string): boolean {
  const r = spawnSync('docker', ['compose', 'ps', '--status', 'running', '-q', service], {
    stdio: 'pipe',
    cwd,
  })
  return r.status === 0 && r.stdout != null && r.stdout.toString().trim().length > 0
}

function section(title: string) {
  const isTTY = process.stdout.isTTY
  const line = '─'.repeat(Math.max(0, 52 - title.length))
  const header = `── ${title} ${line}`
  process.stdout.write(isTTY ? `\n\x1b[1m${header}\x1b[0m\n` : `\n${header}\n`)
}

export const reviewCommand: StackCommandDef = {
  description: 'Run all checks: custom MCP lint, ruff lint, and mypy strict type-checking.',
  async run({ projectRoot, stackRoot }) {
    const serviceDir = path.join(projectRoot, 'fastmcp')
    const isTTY = process.stdout.isTTY
    let ok = true

    // ── 1. Custom MCP lint ──────────────────────────────────────────────────────
    section('dude lint')
    const { diagnostics, errorCount } = await runLint(projectRoot, stackRoot)
    if (diagnostics.length === 0) {
      process.stdout.write('No issues found.\n')
    } else {
      const colorize = (s: string, severity: string) =>
        isTTY ? (severity === 'error' ? `\x1b[31m${s}\x1b[0m` : `\x1b[33m${s}\x1b[0m`) : s
      for (const d of diagnostics) {
        process.stdout.write(colorize(formatDiagnostic(d), d.severity) + '\n')
      }
    }
    ok = errorCount === 0 && ok

    // ── 2. ruff + mypy (fastmcp/) ───────────────────────────────────────────────
    if (existsSync(serviceDir)) {
      const containerUp = isDockerServiceRunning('fastmcp', projectRoot)

      if (!containerUp && !isAvailable('uv')) {
        process.stderr.write(
          '\nerror: uv is required but was not found on your PATH:\n\n' +
            '  • uv  →  https://docs.astral.sh/uv/getting-started/installation/\n\n',
        )
        process.exit(1)
      }

      const run = (label: string, toolArgs: string[]) => {
        section(label)
        if (containerUp) {
          ok = exec('docker', ['compose', 'exec', 'fastmcp', 'uv', 'run', ...toolArgs], projectRoot) && ok
        } else {
          ok = exec('uv', ['run', ...toolArgs], serviceDir) && ok
        }
      }

      if (!containerUp) ensureVenv(serviceDir)
      run('ruff', ['ruff', 'check', 'app/'])
      run('mypy', ['mypy'])
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    process.stdout.write('\n')
    if (ok) {
      process.stdout.write(isTTY ? '\x1b[32mAll checks passed.\x1b[0m\n' : 'All checks passed.\n')
    } else {
      process.stderr.write(isTTY ? '\x1b[31mReview failed.\x1b[0m\n' : 'Review failed.\n')
      process.exit(1)
    }
  },
}
