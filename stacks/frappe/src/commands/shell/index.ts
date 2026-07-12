import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'
import { dc } from '../_docker.js'

export const shellCommand: StackCommandDef = {
  description:
    'Open an interactive shell in a service container (default: bench, inside the frappe-bench directory).',
  args: {
    service: {
      type: 'string',
      description: 'Service name (default: bench).',
      required: false,
    },
  },
  async run({ args }) {
    const svc = typeof args.service === 'string' && args.service ? args.service : 'bench'
    if (svc === 'bench') {
      // Land directly in the bench directory, where `bench …` commands work.
      dc(['exec', '-w', '/home/frappe/frappe-bench', 'bench', '/bin/bash'])
      return
    }
    const bash = spawnSync('docker', ['compose', 'exec', svc, '/bin/bash'], { stdio: 'inherit' })
    if (bash.status !== 0) {
      dc(['exec', svc, '/bin/sh'])
    } else {
      process.exit(bash.status ?? 0)
    }
  },
}
