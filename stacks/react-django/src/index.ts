import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import yaml from 'yaml'
import type { OpenAPI3 } from 'openapi-typescript'
import {
  defineStack,
  renderTemplateTree,
  defineCheatsheetCommand,
  defineDocsCommand,
  defineExplainCommand,
} from '@cubocicloide/dude'
import {
  syncCommand,
  reviewCommand as apiReviewCommand,
  generateClientFromSpec,
} from './commands/api/index.js'
import {
  makemigrationCommand,
  migrateCommand,
  rollbackCommand,
  superuserCommand,
} from './commands/db/index.js'
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
  name: 'react-django',
  version: '0.1.0',
  minDudeVersion: '0.1.0',
  description: 'React (Vite + TypeScript) frontend with a Django REST Framework backend.',

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
      prompt: 'Database (none = SQLite file, fine for dev)',
      choices: ['none', 'postgres'],
      default: 'none',
    },
    {
      name: 'storage',
      type: 'select',
      prompt: 'File storage (s3 = S3-compatible object storage; MinIO locally)',
      choices: ['none', 's3'],
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
      prompt: 'Infrastructure-as-Code (Terraform, AWS ECS Fargate)',
      choices: ['none', 'aws-ecs'],
      default: 'none',
    },
  ],

  docs: {
    tagline:
      'React (Vite) frontend with a Django REST Framework backend — optional S3 storage and AWS ECS Fargate IaC.',
    useCases: [
      "A CRUD/admin-heavy web app that benefits from Django's batteries (admin, ORM, auth)",
      'An API that needs auto-generated OpenAPI docs (drf-spectacular) behind a React frontend',
      'S3-compatible file storage (MinIO locally) with a straightforward path to AWS ECS Fargate',
    ],
    technologies: ['React 19', 'Vite', 'Django REST Framework', 'drf-spectacular', 'Celery'],
    iac: { provider: 'aws-ecs', flag: '--iac aws-ecs' },
    pages: [
      { file: 'index.md', title: 'Home' },
      { file: 'dude.md', title: 'Working with dude' },
      { file: 'api.md', title: 'Command reference' },
      { file: 'cheatsheet.md', title: 'Cheatsheet' },
      { file: 'mkdocs.md', title: 'Writing docs' },
      { file: 'deploy.md', title: 'Deploy (AWS ECS)', when: 'withIac' },
    ],
  },

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion, stackVersion } = ctx

    const withPostgres = answers.database === 'postgres'
    const withS3 = answers.storage === 's3'
    const withCeleryBeat = Boolean(answers.celeryBeat)
    const withCelery = Boolean(answers.celery) || withCeleryBeat
    const withRedis = withCelery
    const withIac = answers.iac === 'aws-ecs'

    const data: Record<string, unknown> = {
      ...answers,
      withPostgres,
      withS3,
      withCelery,
      withCeleryBeat,
      withRedis,
      withIac,
      dudeVersion,
      stackVersion,
    }

    const templates = path.join(stackRoot, 'templates')

    // Base template — always rendered. Ships the Django project (custom User,
    // DRF + drf-spectacular, split settings) on SQLite by default.
    await renderTemplateTree({ src: path.join(templates, 'base'), dest, data })

    // Postgres overlay — switches the DATABASE_URL wiring; the Django code is
    // engine-agnostic, so this only adds compose/env plumbing and helpers.
    if (withPostgres) {
      await renderTemplateTree({ src: path.join(templates, 'postgres'), dest, data })
    }

    // S3 overlay — the `files` Django app (uploads via django-storages/boto3)
    // plus a MinIO service in docker-compose for local development.
    if (withS3) {
      await renderTemplateTree({ src: path.join(templates, 's3'), dest, data })
    }

    // Celery overlay — celery app wiring + example task.
    if (withCelery) {
      await renderTemplateTree({ src: path.join(templates, 'celery'), dest, data })
    }

    // Celery Beat overlay — periodic tasks.
    if (withCeleryBeat) {
      await renderTemplateTree({ src: path.join(templates, 'celerybeat'), dest, data })
    }

    // IaC overlay — Terraform for AWS ECS Fargate (ALB, RDS, optional
    // ElastiCache/S3), prod Dockerfiles, the IaC runner and the deploy docs.
    if (withIac) {
      await renderTemplateTree({ src: path.join(templates, 'aws-ecs'), dest, data })
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
      const withS3 = ctx.answers.storage === 's3'
      const withCelery = Boolean(ctx.answers.celery) || Boolean(ctx.answers.celeryBeat)
      const withIac = ctx.answers.iac === 'aws-ecs'

      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  1. Install the dude launcher once (globally), then provision the project:')
      ctx.logger.info('       npm install -g @cubocicloide/dude-launcher')
      ctx.logger.info(`       cd ${name} && pnpm install`)
      ctx.logger.info('     From now on `dude <cmd>` runs this project’s pinned CLI + stack.')
      ctx.logger.info('')
      ctx.logger.info('  2. Start the stack (migrations run automatically on boot):')
      ctx.logger.info('       dude up --build')
      ctx.logger.info('')
      ctx.logger.info('  3. Create an admin account for /admin/ (optional):')
      ctx.logger.info('       dude db superuser')
      ctx.logger.info('')
      if (withCelery) {
        ctx.logger.info('  Celery workers are started automatically by docker compose.')
        ctx.logger.info('  To monitor tasks, open http://localhost:5555 (Flower).')
        ctx.logger.info('')
      }
      ctx.logger.info('  Endpoints:')
      ctx.logger.info('    Frontend:    http://localhost:5173')
      ctx.logger.info('    Backend:     http://localhost:8000/api/health/')
      ctx.logger.info('    Users:       http://localhost:8000/api/users/')
      ctx.logger.info('    API docs:    http://localhost:8000/api/docs/ (Scalar reference)')
      ctx.logger.info('    Admin:       http://localhost:8000/admin/')
      if (withS3) {
        ctx.logger.info('    Files:       http://localhost:8000/api/files/')
        ctx.logger.info('    MinIO UI:    http://localhost:9001 (minioadmin / minioadmin)')
      }
      if (withIac) {
        ctx.logger.info('')
        ctx.logger.info('  Deploy to AWS ECS Fargate (Terraform) — see iac/README.md:')
        ctx.logger.info('       dude iac login --env dev')
        ctx.logger.info('       dude iac bootstrap --state-bucket-prefix <your-org> --env dev --yes')
        ctx.logger.info('       dude iac init --env dev && dude iac apply --env dev')
        ctx.logger.info('       dude iac ship --env dev && dude iac migrate --env dev')
      }
    },
  },

  rules: [],

  commands: {
    cheatsheet: defineCheatsheetCommand(),
    explain: defineExplainCommand(),
    up: upCommand,
    down: downCommand,
    logs: logsCommand,
    shell: shellCommand,
    lint: lintCommand,
    format: formatCommand,
    review: reviewCommand,
    test: testCommand,
    docs: defineDocsCommand(),
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
      superuser: superuserCommand,
    },
    iac: iacCommands,
  },
})
