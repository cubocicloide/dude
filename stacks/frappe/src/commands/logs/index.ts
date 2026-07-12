import type { StackCommandDef } from '@cubocicloide/dude'
import { dc } from '../_docker.js'

export const logsCommand: StackCommandDef = {
  description: 'Follow service logs (docker compose logs -f [--service <name>]).',
  args: {
    service: {
      type: 'string',
      description: 'Service name (bench, mariadb, redis-cache, redis-queue); omit for all.',
      required: false,
    },
  },
  async run({ args }) {
    const svc = typeof args.service === 'string' && args.service ? args.service : null
    dc(svc ? ['logs', '-f', svc] : ['logs', '-f'])
  },
}
