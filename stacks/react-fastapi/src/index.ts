import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import yaml from 'yaml'
import type { OpenAPI3 } from 'openapi-typescript'
import { defineStack, renderTemplateTree } from '@cubocicloide/dude'
import {
  syncCommand,
  reviewCommand as apiReviewCommand,
  generateClientFromSpec,
} from './commands/api/index.js'
import { makemigrationCommand, migrateCommand, rollbackCommand } from './commands/db/index.js'
import { docsCommand } from './commands/docs/index.js'
import { iacCommands } from './commands/iac/index.js'
import { downCommand } from './commands/down/index.js'
import { formatCommand } from './commands/format/index.js'
import { lintCommand } from './commands/lint/index.js'
import { logsCommand } from './commands/logs/index.js'
import { reviewCommand } from './commands/review/index.js'
import {
  securityScanCommand,
  securityAcceptCommand,
  securityVerifyCommand,
} from './commands/security/index.js'
import { shellCommand } from './commands/shell/index.js'
import { testCommand } from './commands/test/index.js'
import { upCommand } from './commands/up/index.js'

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
    {
      name: 'iac',
      type: 'select',
      prompt: 'Infrastructure-as-Code (Terraform + Helm)',
      choices: ['none', 'aws-eks'],
      default: 'none',
    },
  ],

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion, stackVersion } = ctx

    const withPostgres = answers.database === 'postgres'
    const withCeleryBeat = Boolean(answers.celeryBeat)
    const withCelery = Boolean(answers.celery) || withCeleryBeat
    const withRedis = withCelery
    const withIac = answers.iac === 'aws-eks'

    const data: Record<string, unknown> = {
      ...answers,
      withPostgres,
      withCelery,
      withCeleryBeat,
      withRedis,
      withIac,
      dudeVersion,
      stackVersion,
    }

    const templates = path.join(stackRoot, 'templates')

    // Base template — always rendered
    await renderTemplateTree({ src: path.join(templates, 'base'), dest, data })

    // Postgres overlay — SQLModel, Alembic, migrations, User model
    if (withPostgres) {
      await renderTemplateTree({ src: path.join(templates, 'postgres'), dest, data })
    }

    // Celery overlay — worker app + example task
    if (withCelery) {
      await renderTemplateTree({ src: path.join(templates, 'celery'), dest, data })
    }

    // Celery Beat overlay — periodic tasks
    if (withCeleryBeat) {
      await renderTemplateTree({ src: path.join(templates, 'celerybeat'), dest, data })
    }

    // IaC overlay — Terraform (VPC/EKS/ECR/optional RDS) + Helm chart. The
    // overlay always ships the full chart/modules; the rendered values and
    // module wiring reflect the other answers (withPostgres/withRedis/withCelery…).
    if (withIac) {
      await renderTemplateTree({ src: path.join(templates, 'aws-eks'), dest, data })
    }

    // Generate the typed API client from the openapi.yaml that was just
    // rendered into the destination. This makes `dude api sync` a no-op
    // until the backend routes actually change, and means the frontend
    // openapi/ tree is complete straight after `dude init`.
    const openapiYamlPath = path.join(dest, 'frontend', 'src', 'openapi', 'utils', 'openapi.yaml')
    if (existsSync(openapiYamlPath)) {
      const spec = yaml.parse(readFileSync(openapiYamlPath, 'utf8')) as OpenAPI3
      await generateClientFromSpec(spec, path.join(dest, 'frontend', 'src', 'openapi'), dest)
    }
  },

  hooks: {
    async postInit(ctx) {
      const name = String(ctx.answers.projectName ?? 'your-project')
      const withPostgres = ctx.answers.database === 'postgres'
      const withCelery = Boolean(ctx.answers.celery) || Boolean(ctx.answers.celeryBeat)
      const withIac = ctx.answers.iac === 'aws-eks'

      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  1. Set your GitHub token (needed to install the pinned toolchain):')
      ctx.logger.info('       export GITHUB_TOKEN=<your-pat>')
      ctx.logger.info('')
      ctx.logger.info('  2. Install the dude launcher once (globally), then provision the project:')
      ctx.logger.info('       npm install -g @cubocicloide/dude-launcher')
      ctx.logger.info(`       cd ${name} && pnpm install`)
      ctx.logger.info('     From now on `dude <cmd>` runs this project’s pinned CLI + stack.')
      ctx.logger.info('')
      ctx.logger.info('  3. Start the stack:')
      ctx.logger.info('       dude up --build')
      ctx.logger.info('')
      if (withPostgres) {
        ctx.logger.info('  4. Run migrations (after the stack is up):')
        ctx.logger.info('       dude db migrate')
        ctx.logger.info('       # To create a new migration after model changes:')
        ctx.logger.info('       dude db makemigration --message "describe change"')
        ctx.logger.info('')
      }
      if (withCelery) {
        ctx.logger.info(
          `  ${withPostgres ? '5' : '4'}. Celery workers are started automatically by docker compose.`,
        )
        ctx.logger.info('     To monitor tasks, open http://localhost:5555 (Flower).')
        ctx.logger.info('')
      }
      ctx.logger.info('  Endpoints:')
      ctx.logger.info('    Frontend: http://localhost:5173')
      ctx.logger.info('    Backend:  http://localhost:8000/api/health')
      if (withPostgres) {
        ctx.logger.info('    Users:    http://localhost:8000/api/users/')
      }
      if (withIac) {
        ctx.logger.info('')
        ctx.logger.info('  Deploy to AWS EKS (Terraform + Helm) — see iac/README.md:')
        ctx.logger.info('       dude iac login --env dev')
        ctx.logger.info('       dude iac bootstrap --state-bucket-prefix <your-org> --env dev --yes')
        ctx.logger.info('       dude iac init --env dev && dude iac apply --env dev')
        ctx.logger.info('       dude iac kubeconfig --env dev && dude iac ship --env dev')
      }
    },
  },

  rules: [],

  commands: {
    up: upCommand,
    down: downCommand,
    logs: logsCommand,
    shell: shellCommand,
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
    iac: iacCommands,
  },
})
