import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

function shouldUseShell(): boolean {
  return process.platform === 'win32'
}

function isAvailable(cmd: string): boolean {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: shouldUseShell() })
  return r.error == null // ENOENT → not installed
}

function exec(cmd: string, args: string[], cwd: string): boolean {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: shouldUseShell() })
  if (result.error) {
    process.stderr.write(`error: failed to run ${cmd}: ${result.error.message}\n`)
    return false
  }
  return result.status === 0
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

export const formatCommand: StackCommandDef = {
  description: 'Format the FastMCP server sources with ruff (format + import sort).',
  args: {
    check: {
      type: 'boolean',
      description: 'Check formatting without writing changes (exits 1 if any file would change).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const check = Boolean(args.check)
    const serviceDir = path.join(projectRoot, 'fastmcp')

    if (!existsSync(serviceDir)) {
      process.stderr.write('[format] No fastmcp/ folder found. Make sure you ran `dude init`.\n')
      process.exit(1)
    }

    const containerUp = isDockerServiceRunning('fastmcp', projectRoot)

    // ── Preflight ─────────────────────────────────────────────────────────────
    if (!containerUp && !isAvailable('uv')) {
      process.stderr.write(
        'error: uv is required but was not found on your PATH:\n\n' +
          '  • uv  →  https://docs.astral.sh/uv/getting-started/installation/\n\n',
      )
      process.exit(1)
    }

    process.stdout.write(check ? 'Checking formatting…\n' : 'Formatting…\n')

    let ok = true
    if (containerUp) {
      // Container is running — ruff is already installed in the image; no host venv needed.
      ok =
        exec(
          'docker',
          [
            'compose',
            'exec',
            'fastmcp',
            'uv',
            'run',
            'ruff',
            'format',
            ...(check ? ['--check'] : []),
            'app/',
          ],
          projectRoot,
        ) && ok
      ok =
        exec(
          'docker',
          [
            'compose',
            'exec',
            'fastmcp',
            'uv',
            'run',
            'ruff',
            'check',
            '--select',
            'I',
            ...(check ? [] : ['--fix']),
            'app/',
          ],
          projectRoot,
        ) && ok
    } else {
      // Container not running — fall back to local uv + venv.
      const venvReady = ensureVenv(serviceDir)
      if (!venvReady) {
        process.stderr.write('error: uv sync failed in fastmcp/\n')
        ok = false
      }
      if (venvReady) {
        ok =
          exec(
            'uv',
            ['run', 'ruff', 'format', ...(check ? ['--check'] : []), 'app/'],
            serviceDir,
          ) && ok
        ok =
          exec(
            'uv',
            ['run', 'ruff', 'check', '--select', 'I', ...(check ? [] : ['--fix']), 'app/'],
            serviceDir,
          ) && ok
      }
    }

    if (!ok) process.exit(1)
  },
}
