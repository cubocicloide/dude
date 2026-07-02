import { existsSync } from 'node:fs'
import path from 'pathe'
import { runLint, formatDiagnostic, type StackCommandDef } from '@cubocicloide/dude'
import { exec, isAvailable, localBin, section, verdict } from '../_exec.js'

export const reviewCommand: StackCommandDef = {
  description:
    'Run all checks: dude lint, ESLint, TypeScript, cargo fmt --check and cargo clippy.',
  async run({ projectRoot, stackRoot }) {
    const isTTY = process.stdout.isTTY
    let ok = true

    // ── 1. Structural lint ────────────────────────────────────────────────────
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

    // ── 2. Frontend: ESLint + tsc ─────────────────────────────────────────────
    const eslint = localBin(projectRoot, 'eslint')
    const tsc = localBin(projectRoot, 'tsc')
    if (eslint == null || tsc == null) {
      process.stderr.write(
        '\nerror: frontend toolchain not installed. Run `pnpm install` first.\n',
      )
      process.exit(1)
    }
    section('eslint')
    ok = exec(eslint, ['src'], projectRoot) && ok
    section('tsc')
    ok = exec(tsc, ['--noEmit'], projectRoot) && ok

    // ── 3. Backend: cargo fmt --check + clippy ────────────────────────────────
    const tauriDir = path.join(projectRoot, 'src-tauri')
    if (existsSync(tauriDir)) {
      if (!isAvailable('cargo')) {
        process.stderr.write(
          '\nerror: cargo is required but was not found on your PATH:\n\n' +
            '  • Rust  →  https://www.rust-lang.org/tools/install\n\n',
        )
        process.exit(1)
      }
      section('cargo fmt --check')
      ok = exec('cargo', ['fmt', '--check'], tauriDir) && ok
      section('cargo clippy')
      ok = exec('cargo', ['clippy', '--all-targets', '--', '-D', 'warnings'], tauriDir) && ok
    }

    verdict(ok, 'All checks passed.', 'Review failed.')
  },
}
