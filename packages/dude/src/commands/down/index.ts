import { defineCommand } from 'citty'
import { dc } from '../_docker.js'

export const downCommand = defineCommand({
  meta: {
    name: 'down',
    description: 'Stop and remove all service containers (docker compose down).',
  },
  async run() {
    dc(['down'])
  },
})
