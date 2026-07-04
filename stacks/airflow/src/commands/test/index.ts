import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

function exec(cmd: string, args: string[], cwd: string): boolean {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  return r.status === 0 && r.error == null
}

function section(title: string) {
  const isTTY = process.stdout.isTTY
  const line = '─'.repeat(Math.max(0, 52 - title.length))
  const header = `── ${title} ${line}`
  process.stdout.write(isTTY ? `\n\x1b[1m${header}\x1b[0m\n` : `\n${header}\n`)
}

/**
 * DAG integrity tests run INSIDE the Airflow image (they import the real
 * `airflow` package plus every provider the DAGs use), via a throwaway
 * `airflow-cli` container. `--no-deps` keeps the metadata DB out of the loop —
 * importing DAGs never touches it.
 */
export const testCommand: StackCommandDef = {
  description: 'Run the DAG integrity test suite (pytest inside the Airflow image).',
  args: {
    k: {
      type: 'string',
      description: 'Only run tests matching the given pytest -k expression.',
      required: false,
    },
  },
  async run({ projectRoot, args }) {
    if (!existsSync(path.join(projectRoot, 'airflow', 'tests'))) {
      process.stderr.write(
        '[test] No airflow/tests/ folder found. Make sure you ran `dude init`.\n',
      )
      process.exit(1)
    }

    const filter = typeof args.k === 'string' && args.k ? ` -k '${args.k.replace(/'/g, '')}'` : ''

    section('pytest (dag integrity)')
    const ok = exec(
      'docker',
      [
        'compose',
        'run',
        '--rm',
        '--no-deps',
        'airflow-cli',
        'bash',
        '-c',
        `pytest -q /opt/airflow/tests${filter}`,
      ],
      projectRoot,
    )

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
