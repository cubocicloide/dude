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

/**
 * The Airflow scaffold has no Python project of its own (DAGs run inside the
 * official image), so formatting uses `uvx ruff` — an ephemeral ruff run that
 * needs nothing installed beyond uv itself.
 */
export const formatCommand: StackCommandDef = {
  description: 'Format the DAGs, plugins and tests with ruff (format + import sort).',
  args: {
    check: {
      type: 'boolean',
      description: 'Check formatting without writing changes (exits 1 if any file would change).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const check = Boolean(args.check)
    const airflowDir = path.join(projectRoot, 'airflow')

    if (!existsSync(airflowDir)) {
      process.stderr.write('[format] No airflow/ folder found. Make sure you ran `dude init`.\n')
      process.exit(1)
    }

    if (!isAvailable('uvx')) {
      process.stderr.write(
        'error: uv is required but was not found on your PATH:\n\n' +
          '  • uv  →  https://docs.astral.sh/uv/getting-started/installation/\n\n',
      )
      process.exit(1)
    }

    process.stdout.write(check ? 'Checking formatting…\n' : 'Formatting…\n')

    const targets = ['dags/', 'plugins/', 'tests/', 'config/']
    let ok = true
    ok = exec('uvx', ['ruff', 'format', ...(check ? ['--check'] : []), ...targets], airflowDir) && ok
    ok =
      exec(
        'uvx',
        ['ruff', 'check', '--select', 'I', ...(check ? [] : ['--fix']), ...targets],
        airflowDir,
      ) && ok

    if (!ok) process.exit(1)
  },
}
