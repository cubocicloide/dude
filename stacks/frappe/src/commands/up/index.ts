import type { StackCommandDef } from '@cubocicloide/dude'
import { dc } from '../_docker.js'

export const upCommand: StackCommandDef = {
  description:
    'Start all services (docker compose up -d). First boot provisions the bench + site — follow with `dude logs --service bench`.',
  args: {
    build: { type: 'boolean', description: 'Rebuild images before starting.', default: false },
  },
  async run({ args }) {
    dc(Boolean(args.build) ? ['up', '-d', '--build'] : ['up', '-d'])
  },
}
