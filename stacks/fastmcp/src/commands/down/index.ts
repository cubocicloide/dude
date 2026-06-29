import type { StackCommandDef } from '@cubocicloide/dude'
import { dc } from '../_docker.js'

export const downCommand: StackCommandDef = {
  description: 'Stop and remove all service containers (docker compose down).',
  args: {},
  async run() {
    dc(['down'])
  },
}
