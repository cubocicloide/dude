import { defineStack } from '@cubocicloide/dude'

export default defineStack({
  name: 'react-fastapi',
  version: '0.1.0',
  minDudeVersion: '0.1.0',
  description: 'React (Vite + TypeScript) frontend with a FastAPI backend.',

  variables: [
    {
      name: 'projectName',
      type: 'string',
      prompt: 'Project name',
      pattern: '^[a-z][a-z0-9-]*$',
      default: 'my-app',
    },
    {
      name: 'pythonVersion',
      type: 'select',
      prompt: 'Python version',
      choices: ['3.11', '3.12', '3.13'],
      default: '3.12',
    },
  ],

  hooks: {
    async postInit(ctx) {
      const name = ctx.answers.projectName ?? 'your-project'
      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  Run with Docker (recommended):')
      ctx.logger.info(`    cd ${name}`)
      ctx.logger.info('    docker compose up --build')
      ctx.logger.info('')
      ctx.logger.info('  Run locally (without Docker):')
      ctx.logger.info(`    cd ${name}`)
      ctx.logger.info('    pnpm --filter ./frontend install && pnpm --filter ./frontend dev')
      ctx.logger.info('    uv sync --project backend && uv run --project backend uvicorn app.main:app --reload')
    },
  },
})
