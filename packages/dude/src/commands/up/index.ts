import { defineCommand } from 'citty'
import { dc } from '../_docker.js'

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
