import type { StackCommandDef } from '@cubocicloide/dude'
import { dc } from '../_docker.js'

export const downCommand: StackCommandDef = {
  description: 'Stop and remove all service containers (docker compose down).',
  args: {
    volumes: {
      type: 'boolean',
      description: 'Also remove volumes — DESTROYS the bench and the database.',
      default: false,
    },
  },
  async run({ args }) {
    dc(Boolean(args.volumes) ? ['down', '--volumes'] : ['down'])
  },
}
