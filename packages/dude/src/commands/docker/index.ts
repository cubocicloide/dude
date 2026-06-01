import { defineCommand } from 'citty'
import { spawnSync } from 'node:child_process'

function dc(args: string[]) {
  const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' })
  process.exit(result.status ?? 0)
}

export const upCommand = defineCommand({
  meta: {
    name: 'up',
    description: 'Start all services (docker compose up -d). Use --build to rebuild images.',
  },
  args: {
    build: {
      type: 'boolean',
      description: 'Rebuild images before starting.',
      default: false,
    },
  },
  async run({ args }) {
    dc(args.build ? ['up', '--build'] : ['up', '-d'])
  },
})

export const downCommand = defineCommand({
  meta: {
    name: 'down',
    description: 'Stop and remove all service containers (docker compose down).',
  },
  async run() {
    dc(['down'])
  },
})

export const logsCommand = defineCommand({
  meta: {
    name: 'logs',
    description: 'Follow service logs (docker compose logs -f [service]).',
  },
  args: {
    service: {
      type: 'positional',
      description: 'Service name (omit to follow all services).',
      required: false,
    },
  },
  async run({ args }) {
    dc(args.service ? ['logs', '-f', args.service] : ['logs', '-f'])
  },
})

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
