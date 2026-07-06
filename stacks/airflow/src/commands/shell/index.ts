import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'
import { dc } from '../_docker.js'

export const shellCommand: StackCommandDef = {
  description: 'Open an interactive shell in a service container (default: airflow-apiserver).',
  args: {
    service: {
      type: 'string',
      description: 'Service name (default: airflow-apiserver).',
      required: false,
      default: 'airflow-apiserver',
    },
  },
  async run({ args }) {
    const svc =
      typeof args.service === 'string' && args.service ? args.service : 'airflow-apiserver'
    // Try bash first, fall back to sh
    const bash = spawnSync('docker', ['compose', 'exec', svc, '/bin/bash'], { stdio: 'inherit' })
    if (bash.status !== 0) {
      dc(['exec', svc, '/bin/sh'])
    } else {
      process.exit(bash.status ?? 0)
    }
  },
}
