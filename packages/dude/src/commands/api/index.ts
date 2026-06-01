import { defineCommand } from 'citty'
import { apiSyncCommand } from './sync.js'
import { apiReviewCommand } from './review.js'

export const apiCommand = defineCommand({
  meta: {
    name: 'api',
    description: 'Generate and review the typed OpenAPI client for the frontend.',
  },
  subCommands: {
    sync: apiSyncCommand,
    review: apiReviewCommand,
  },
})
