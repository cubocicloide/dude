import type { StackCommandDef } from '@cubocicloide/dude'
import { dc } from '../_docker.js'

export const logsCommand: StackCommandDef = {
  description: 'Follow service logs (docker compose logs -f [service]).',
  args: {
    service: {
      type: 'string',
      description: 'Service name (omit to follow all services).',
      required: false,
    },
  },
  async run({ args }) {
    const svc = typeof args.service === 'string' && args.service ? args.service : null
    dc(svc ? ['logs', '-f', svc] : ['logs', '-f'])
  },
}
