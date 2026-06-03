import path from 'pathe'
import { defineStack, renderTemplateTree } from '@cubocicloide/dude'
import { syncCommand, reviewCommand as apiReviewCommand } from './commands/api/index.js'
import { makemigrationCommand, migrateCommand, rollbackCommand } from './commands/db/index.js'
import { docsCommand } from './commands/docs/index.js'
import { formatCommand } from './commands/format/index.js'
import { lintCommand } from './commands/lint/index.js'
import { reviewCommand } from './commands/review/index.js'
import { testCommand } from './commands/test/index.js'
import {
  securityScanCommand,
  securityAcceptCommand,
  securityVerifyCommand,
} from './commands/security/index.js'

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
      name: 'database',
      type: 'select',
      prompt: 'Database',
      choices: ['none', 'postgres'],
      default: 'none',
    },
    {
      name: 'celery',
      type: 'boolean',
      prompt: 'Add Celery worker?',
      default: false,
    },
    {
      name: 'celeryBeat',
      type: 'boolean',
      prompt: 'Add Celery Beat scheduler? (requires Celery — auto-enabled)',
      default: false,
    },
  ],

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion } = ctx

    const withPostgres = answers.database === 'postgres'
    const withCeleryBeat = Boolean(answers.celeryBeat)
    const withCelery = Boolean(answers.celery) || withCeleryBeat
    const withRedis = withCelery

    const data: Record<string, unknown> = {
      ...answers,
      withPostgres,
      withCelery,
      withCeleryBeat,
      withRedis,
      dudeVersion,
    }

    // Base template — always rendered
    await renderTemplateTree({ src: path.join(stackRoot, 'template'), dest, data })

    // Postgres overlay — SQLModel, Alembic, migrations, User model
    if (withPostgres) {
      await renderTemplateTree({ src: path.join(stackRoot, 'template-postgres'), dest, data })
    }

    // Celery overlay — worker app + example task
    if (withCelery) {
      await renderTemplateTree({ src: path.join(stackRoot, 'template-celery'), dest, data })
    }

    // Celery Beat overlay — periodic tasks
    if (withCeleryBeat) {
      await renderTemplateTree({ src: path.join(stackRoot, 'template-celerybeat'), dest, data })
    }
  },

  hooks: {
    async postInit(ctx) {
      const name = String(ctx.answers.projectName ?? 'your-project')
      const withPostgres = ctx.answers.database === 'postgres'
      const withCelery = Boolean(ctx.answers.celery) || Boolean(ctx.answers.celeryBeat)

      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  1. Set your GitHub token (needed to install dude in the project):')
      ctx.logger.info('       export GITHUB_TOKEN=<your-pat>')
      ctx.logger.info('')
      ctx.logger.info('  2. Start the stack:')
      ctx.logger.info(`       cd ${name}`)
      ctx.logger.info('       docker compose up --build')
      ctx.logger.info('')
      if (withPostgres) {
        ctx.logger.info('  3. Run migrations (after docker compose is up):')
        ctx.logger.info('       dude db migrate')
        ctx.logger.info('       # To create a new migration after model changes:')
        ctx.logger.info('       dude db makemigration --message "describe change"')
        ctx.logger.info('')
      }
      if (withCelery) {
        ctx.logger.info(`  ${withPostgres ? '4' : '3'}. Celery workers are started automatically by docker compose.`)
        ctx.logger.info('     To monitor tasks, open http://localhost:5555 (Flower).')
        ctx.logger.info('')
      }
      ctx.logger.info('  Endpoints:')
      ctx.logger.info('    Frontend: http://localhost:5173')
      ctx.logger.info('    Backend:  http://localhost:8000/api/health')
      if (withPostgres) {
        ctx.logger.info('    Users:    http://localhost:8000/api/users/')
      }
    },
  },

  rules: [],

  commands: {
    lint: lintCommand,
    format: formatCommand,
    review: reviewCommand,
    test: testCommand,
    docs: docsCommand,
    security: {
      scan: securityScanCommand,
      accept: securityAcceptCommand,
      verify: securityVerifyCommand,
    },
    api: {
      sync: syncCommand,
      review: apiReviewCommand,
    },
    db: {
      makemigration: makemigrationCommand,
      migrate: migrateCommand,
      rollback: rollbackCommand,
    },
  },
})

