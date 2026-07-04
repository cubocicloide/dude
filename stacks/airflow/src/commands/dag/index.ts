/**
 * `dude dag *` — thin wrappers around the Airflow CLI, run through the compose
 * `airflow-cli` service so nothing needs to be installed on the host.
 *
 * Commands that only parse DAG files (`list`, `errors`, `test`) don't need the
 * whole deployment up; ones that write to the metadata DB (`trigger`,
 * `pause`/`unpause`) start the DB dependency automatically via compose.
 */
import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'

function cli(args: string[], opts: { noDeps?: boolean } = {}): never {
  const composeArgs = [
    'compose',
    'run',
    '--rm',
    ...(opts.noDeps ? ['--no-deps'] : []),
    'airflow-cli',
    'airflow',
    ...args,
  ]
  const r = spawnSync('docker', composeArgs, { stdio: 'inherit' })
  process.exit(r.status ?? 1)
}

export const dagListCommand: StackCommandDef = {
  description: 'List every DAG the project defines (airflow dags list).',
  args: {},
  async run() {
    cli(['dags', 'list'], { noDeps: true })
  },
}

export const dagErrorsCommand: StackCommandDef = {
  description: 'Show DAG import errors, if any (airflow dags list-import-errors).',
  args: {},
  async run() {
    cli(['dags', 'list-import-errors'], { noDeps: true })
  },
}

export const dagTriggerCommand: StackCommandDef = {
  description: 'Trigger a DAG run (airflow dags trigger).',
  args: {
    id: { type: 'string', description: 'The dag_id to trigger.', required: true },
    conf: {
      type: 'string',
      description: 'JSON configuration for the run (e.g. \'{"simulate": false}\').',
      required: false,
    },
  },
  async run({ args }) {
    const id = String(args.id ?? '')
    const conf = typeof args.conf === 'string' && args.conf ? ['--conf', args.conf] : []
    cli(['dags', 'trigger', id, ...conf])
  },
}

export const dagTestCommand: StackCommandDef = {
  description:
    'Run a single DAG to completion in-process, without the scheduler (airflow dags test).',
  args: {
    id: { type: 'string', description: 'The dag_id to test.', required: true },
    date: {
      type: 'string',
      description: 'Logical date for the run (YYYY-MM-DD, default: today).',
      required: false,
    },
  },
  async run({ args }) {
    const id = String(args.id ?? '')
    const date = typeof args.date === 'string' && args.date ? [args.date] : []
    cli(['dags', 'test', id, ...date])
  },
}

export const dagCommands: Record<string, StackCommandDef> = {
  list: dagListCommand,
  errors: dagErrorsCommand,
  trigger: dagTriggerCommand,
  test: dagTestCommand,
}
