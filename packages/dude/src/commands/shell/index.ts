import { defineCommand } from 'citty'
import { spawnSync } from 'node:child_process'
import { dc } from '../_docker.js'

export const shellCommand = defineCommand({
  meta: {
    name: 'shell',
    description: 'Open an interactive shell in a service container.',
  },
  args: {
    service: {
      type: 'positional',
      description: 'Service name (e.g. backend, frontend).',
      required: true,
    },
  },
  async run({ args }) {
    // Try bash first, fall back to sh
    const bash = spawnSync('docker', ['compose', 'exec', args.service, '/bin/bash'], {
      stdio: 'inherit',
    })
    if (bash.status !== 0) {
      dc(['exec', args.service, '/bin/sh'])
    } else {
      process.exit(bash.status ?? 0)
    }
  },
})
