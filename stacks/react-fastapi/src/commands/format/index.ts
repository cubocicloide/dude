import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

function isAvailable(cmd: string): boolean {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
  return r.error == null // ENOENT → not installed
}

function exec(cmd: string, args: string[], cwd: string): boolean {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  return result.status === 0 && result.error == null
}

function hasLocalExecutable(dir: string, executable: string): boolean {
  const localBin = path.join(dir, 'node_modules', '.bin', executable)
  return existsSync(localBin)
}

function ensureNodeModules(dir: string, executable?: string): boolean {
  const nodeModulesDir = path.join(dir, 'node_modules')
  const hasDeps = existsSync(nodeModulesDir)
  const hasExecutable = executable == null || hasLocalExecutable(dir, executable)
  if (hasDeps && hasExecutable) return true

  process.stdout.write(
    hasDeps
      ? `${executable ?? 'required dependency'} not found — running pnpm install…\n`
      : 'node_modules not found — running pnpm install…\n',
  )
  return exec('pnpm', ['install'], dir)
}

export const formatCommand: StackCommandDef = {
  description: 'Format backend (ruff) and frontend (prettier) source files.',
  args: {
    check: {
      type: 'boolean',
      description: 'Check formatting without writing changes (exits 1 if any file would change).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const check = Boolean(args.check)
    const backendDir = path.join(projectRoot, 'backend')
    const frontendDir = path.join(projectRoot, 'frontend')
    const e2eDir = path.join(projectRoot, 'e2e')

    // ── Preflight ─────────────────────────────────────────────────────────────
    const missing: string[] = []
    if (existsSync(backendDir) && !isAvailable('uv'))
      missing.push('uv  →  https://docs.astral.sh/uv/getting-started/installation/')
    if ((existsSync(frontendDir) || existsSync(e2eDir)) && !isAvailable('pnpm'))
      missing.push('pnpm  →  https://pnpm.io/installation')
    if (missing.length > 0) {
      process.stderr.write(
        'error: the following tools are required but were not found on your PATH:\n\n',
      )
      for (const m of missing) process.stderr.write(`  • ${m}\n`)
      process.stderr.write('\n')
      process.exit(1)
    }

    let ok = true

    // ── Backend ───────────────────────────────────────────────────────────────
    if (existsSync(backendDir)) {
      process.stdout.write(check ? 'Checking backend formatting…\n' : 'Formatting backend…\n')

      // ruff format: black-compatible formatter
      ok =
        exec(
          'uv',
          ['run', 'ruff', 'format', ...(check ? ['--check'] : []), 'backend/'],
          projectRoot,
        ) && ok

      // ruff check --select I: isort-compatible import sorting
      ok =
        exec(
          'uv',
          ['run', 'ruff', 'check', '--select', 'I', ...(check ? [] : ['--fix']), 'backend/'],
          projectRoot,
        ) && ok
    }

    // ── Frontend ──────────────────────────────────────────────────────────────
    if (existsSync(frontendDir)) {
      process.stdout.write(check ? 'Checking frontend formatting…\n' : 'Formatting frontend…\n')

      const ready = ensureNodeModules(frontendDir, 'prettier')
      if (!ready) {
        process.stderr.write('error: pnpm install failed in frontend/\n')
        ok = false
      }
      if (ready) {
        ok =
          exec(
            'pnpm',
            ['exec', 'prettier', ...(check ? ['--check'] : ['--write']), 'src/'],
            frontendDir,
          ) && ok
      }
    }

    // ── E2E ───────────────────────────────────────────────────────────────────
    if (existsSync(e2eDir)) {
      process.stdout.write(check ? 'Checking e2e formatting…\n' : 'Formatting e2e…\n')

      const ready = ensureNodeModules(e2eDir, 'prettier')
      if (!ready) {
        process.stderr.write('error: pnpm install failed in e2e/\n')
        ok = false
      }
      if (ready) {
        ok =
          exec(
            'pnpm',
            [
              'exec',
              'prettier',
              ...(check ? ['--check'] : ['--write']),
              '**/*.{ts,json}',
              '--ignore-path',
              '.prettierignore',
            ],
            e2eDir,
          ) && ok
      }
    }

    if (!ok) process.exit(1)
  },
}
