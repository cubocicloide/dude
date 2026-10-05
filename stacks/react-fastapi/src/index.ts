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
import { makemigrationCommand, migrateCommand, rollbackCommand } from './commands/db/index.js'
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
      prompt: 'Infrastructure-as-Code (Terraform; Helm on the Kubernetes targets)',
      choices: ['none', 'aws-eks', 'azure-aks', 'azure-aca'],
      default: 'none',
    },
  ],

  docs: {
    tagline:
      'React (Vite) frontend with a FastAPI backend — Postgres, Celery, and Kubernetes IaC on AWS or Azure when you need them.',
    useCases: [
      'A CRUD/product web app that needs a typed REST API behind a modern SPA',
      'A Python + TypeScript team that wants Kubernetes-grade IaC (AWS EKS or Azure AKS) once it scales',
      'A project whose hosting cloud is the customer\u2019s decision, not the code\u2019s',
      'Background/async work (Celery + Celery Beat) without leaving the Python backend',
    ],
    technologies: ['React 19', 'Vite', 'FastAPI', 'SQLModel', 'Alembic', 'Celery'],
    iac: [
      { provider: 'aws-eks', flag: '--iac aws-eks' },
      { provider: 'azure-aks', flag: '--iac azure-aks' },
      { provider: 'azure-aca', flag: '--iac azure-aca' },
    ],
    pages: [
      { file: 'index.md', title: 'Home' },
      { file: 'dude.md', title: 'Working with dude' },
      { file: 'api.md', title: 'Command reference' },
      { file: 'cheatsheet.md', title: 'Cheatsheet' },
      { file: 'mkdocs.md', title: 'Writing docs' },
      { file: 'deploy.md', title: 'Deploy to the cloud', when: 'withIac' },
    ],
  },

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion, stackVersion } = ctx

    const withPostgres = answers.database === 'postgres'
    const withCeleryBeat = Boolean(answers.celeryBeat)
    const withCelery = Boolean(answers.celery) || withCeleryBeat
    const withRedis = withCelery
    // One `withIac` for everything the scaffold gates on "is this project
    // deployed to a cloud at all" (the deploy docs page, the IaC section of
    // CLAUDE.md), plus one boolean per target for the handful of places that
    // genuinely differ. `iacLabel` carries the cloud's name into prose so the
    // base templates don't have to branch just to print it.
    const withAwsEks = answers.iac === 'aws-eks'
    const withAzureAks = answers.iac === 'azure-aks'
    const withAzureAca = answers.iac === 'azure-aca'
    const withIac = withAwsEks || withAzureAks || withAzureAca
    // `withKubernetes` is what the templates should branch on wherever the
    // distinction is "is there a cluster", not "which cloud" — the Container
    // Apps target is the first one where those two questions differ.
    const withKubernetes = withAwsEks || withAzureAks
    const iacLabel = withAwsEks
      ? 'AWS EKS'
      : withAzureAks
        ? 'Azure AKS'
        : withAzureAca
          ? 'Azure Container Apps'
          : ''

    const data: Record<string, unknown> = {
      ...answers,
      withPostgres,
      withCelery,
      withCeleryBeat,
      withRedis,
      withIac,
      withAwsEks,
      withAzureAks,
      withAzureAca,
      withKubernetes,
      iacLabel,
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

    // IaC overlay — Terraform + a Helm chart for the chosen cloud. Exactly one
    // applies: both scaffold into `iac/`, and the provider a project gets is
    // decided by the recorded `iac` answer, not by what is on disk.
    //   aws-eks:   VPC / EKS / ECR / ALB controller / optional RDS
    //   azure-aks: resource group / VNet / AKS / ACR / ingress-nginx /
    //              optional PostgreSQL Flexible Server
    // Each overlay always ships its full chart + modules; the rendered values and
    // module wiring reflect the other answers (withPostgres/withRedis/withCelery…).
    if (withAwsEks) {
      await renderTemplateTree({ src: path.join(templates, 'aws-eks'), dest, data })
    }
    if (withAzureAks) {
      await renderTemplateTree({ src: path.join(templates, 'azure-aks'), dest, data })
    }
    if (withAzureAca) {
      await renderTemplateTree({ src: path.join(templates, 'azure-aca'), dest, data })
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
      const withAwsEks = ctx.answers.iac === 'aws-eks'
      const withAzureAks = ctx.answers.iac === 'azure-aks'
      const withAzureAca = ctx.answers.iac === 'azure-aca'

      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  1. Install the dude launcher once (globally), then provision the project:')
      ctx.logger.info('       npm install -g @cubocicloide/dude-launcher')
      ctx.logger.info(`       cd ${name} && pnpm install`)
      ctx.logger.info('     From now on `dude <cmd>` runs this project’s pinned CLI + stack.')
      ctx.logger.info('')
      ctx.logger.info('  2. Start the stack:')
      ctx.logger.info('       dude up --build')
      ctx.logger.info('')
      if (withPostgres) {
        ctx.logger.info('  3. Run migrations (after the stack is up):')
        ctx.logger.info('       dude db migrate')
        ctx.logger.info('       # To create a new migration after model changes:')
        ctx.logger.info('       dude db makemigration --message "describe change"')
        ctx.logger.info('')
      }
      if (withCelery) {
        ctx.logger.info(
          `  ${withPostgres ? '4' : '3'}. Celery workers are started automatically by docker compose.`,
        )
        ctx.logger.info('     To monitor tasks, open http://localhost:5555 (Flower).')
        ctx.logger.info('')
      }
      ctx.logger.info('  Endpoints:')
      ctx.logger.info('    Frontend: http://localhost:5173')
      ctx.logger.info('    Backend:  http://localhost:8000/api/health')
      ctx.logger.info('    API docs: http://localhost:8000/api/docs (Scalar reference)')
      if (withPostgres) {
        ctx.logger.info('    Users:    http://localhost:8000/api/users')
      }
      if (withAwsEks) {
        ctx.logger.info('')
        ctx.logger.info('  Deploy to AWS EKS (Terraform + Helm) — see iac/README.md:')
        ctx.logger.info('       dude iac login --env dev')
        ctx.logger.info('       dude iac bootstrap --state-bucket-prefix <your-org> --env dev --yes')
        ctx.logger.info('       dude iac init --env dev && dude iac apply --env dev')
        ctx.logger.info('       dude iac kubeconfig --env dev && dude iac ship --env dev')
      }
      if (withAzureAks) {
        ctx.logger.info('')
        ctx.logger.info('  Deploy to Azure AKS (Terraform + Helm) — see iac/README.md:')
        ctx.logger.info('       dude iac login --env dev')
        ctx.logger.info('       dude iac bootstrap --state-prefix <your-org> --env dev --yes')
        ctx.logger.info('       dude iac init --env dev && dude iac apply --env dev')
        ctx.logger.info('       dude iac kubeconfig --env dev && dude iac ship --env dev')
        ctx.logger.info('     The app is published on Azure\u2019s own hostname:')
        ctx.logger.info(`       http://${name}-dev.northeurope.cloudapp.azure.com/`)
      }
      if (withAzureAca) {
        ctx.logger.info('')
        ctx.logger.info('  Deploy to Azure Container Apps (Terraform) \u2014 see iac/README.md:')
        ctx.logger.info('       dude iac login --env dev')
        ctx.logger.info('       dude iac bootstrap --state-prefix <your-org> --env dev --yes')
        ctx.logger.info('       dude iac init --env dev && dude iac apply --env dev')
        ctx.logger.info('       dude iac ship --env dev')
        ctx.logger.info('     The app is served over HTTPS on an Azure-managed hostname')
        ctx.logger.info('     (no domain or certificate needed) \u2014 dude iac output prints it.')
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
    },
    iac: iacCommands,
  },
})
