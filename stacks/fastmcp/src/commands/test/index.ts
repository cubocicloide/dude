import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

function isAvailable(cmd: string): boolean {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
  return r.error == null
}

function exec(cmd: string, args: string[], cwd: string): boolean {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  return r.status === 0 && r.error == null
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

export const testCommand: StackCommandDef = {
  description:
    'Run the FastMCP server test suite (pytest: unit + in-memory MCP integration).',
  args: {
    k: {
      type: 'string',
      description: 'Only run tests matching the given pytest -k expression.',
      required: false,
    },
  },
  async run({ projectRoot, args }) {
    const serviceDir = path.join(projectRoot, 'fastmcp')

    if (!existsSync(serviceDir)) {
      process.stderr.write('[test] No fastmcp/ folder found. Make sure you ran `dude init`.\n')
      process.exit(1)
    }

    const filter = typeof args.k === 'string' && args.k ? ['-k', args.k] : []
    const containerUp = isDockerServiceRunning('fastmcp', projectRoot)

    // ── Preflight ─────────────────────────────────────────────────────────────
    if (!containerUp && !isAvailable('uv')) {
      process.stderr.write(
        'error: uv is required but was not found on your PATH:\n\n' +
          '  • uv  →  https://docs.astral.sh/uv/getting-started/installation/\n\n',
      )
      process.exit(1)
    }

    section('pytest')
    const ok = containerUp
      ? exec(
          'docker',
          ['compose', 'exec', 'fastmcp', 'uv', 'run', 'pytest', ...filter],
          projectRoot,
        )
      : exec('uv', ['run', 'pytest', ...filter], serviceDir)

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
