import { defineCommand } from 'citty'
import { dc } from '../_docker.js'

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
