import path from 'pathe'
import { defineStack, renderTemplateTree } from '@cubocicloide/dude'
import { dagCommands } from './commands/dag/index.js'
import { docsCommand } from './commands/docs/index.js'
import { downCommand } from './commands/down/index.js'
import { formatCommand } from './commands/format/index.js'
import { iacCommands } from './commands/iac/index.js'
import { lintCommand } from './commands/lint/index.js'
import { logsCommand } from './commands/logs/index.js'
import { shellCommand } from './commands/shell/index.js'
import { testCommand } from './commands/test/index.js'
import { upCommand } from './commands/up/index.js'

export default defineStack({
  name: 'airflow',
  version: '0.1.0',
  minDudeVersion: '0.1.0',
  description:
    'An Apache Airflow project — organized DAGs & plugins, native or Entra ID SSO, optional AWS ECS Fargate IaC.',

  variables: [
    {
      name: 'projectName',
      type: 'string',
      prompt: 'Project name',
      pattern: '^[a-z][a-z0-9-]*$',
      default: 'my-airflow',
    },
    {
      name: 'sso',
      type: 'select',
      prompt: 'Web UI sign-on (native = Airflow user database, entra-id = Microsoft Entra ID OAuth)',
      choices: ['native', 'entra-id'],
      default: 'native',
    },
    {
      name: 'iac',
      type: 'select',
      prompt: 'Infrastructure-as-Code (Terraform, AWS ECS Fargate + ECS executor)',
      choices: ['none', 'aws-ecs'],
      default: 'none',
    },
  ],

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion, stackVersion } = ctx

    const withEntraId = answers.sso === 'entra-id'
    const withIac = answers.iac === 'aws-ecs'

    const data: Record<string, unknown> = {
      ...answers,
      withEntraId,
      withIac,
      dudeVersion,
      stackVersion,
    }

    const templates = path.join(stackRoot, 'templates')

    // Base template — always rendered. SSO differences are handled inside the
    // base .hbs files ({{#if withEntraId}}), so the only overlay is the IaC one.
    await renderTemplateTree({ src: path.join(templates, 'base'), dest, data })

    // IaC overlay — Terraform for ECS Fargate (RDS + ALB + ECS executor), the
    // production Dockerfile, the IaC runner and the deploy docs page.
    if (withIac) {
      await renderTemplateTree({ src: path.join(templates, 'aws-ecs'), dest, data })
    }
  },

  hooks: {
    async postInit(ctx) {
      const name = String(ctx.answers.projectName ?? 'your-project')
      const withEntraId = ctx.answers.sso === 'entra-id'
      const withIac = ctx.answers.iac === 'aws-ecs'

      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  1. Install the dude launcher once (globally), then provision the project:')
      ctx.logger.info('       npm install -g @cubocicloide/dude-launcher')
      ctx.logger.info(`       cd ${name} && pnpm install`)
      ctx.logger.info('     From now on `dude <cmd>` runs this project’s pinned CLI + stack.')
      ctx.logger.info('')
      if (withEntraId) {
        ctx.logger.info('  2. Fill the Entra ID app registration values in .env:')
        ctx.logger.info('       AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET')
        ctx.logger.info('     (see docs/docs/sso.md for the app-registration walkthrough)')
        ctx.logger.info('')
        ctx.logger.info('  3. Start Airflow:')
      } else {
        ctx.logger.info('  2. Start Airflow:')
      }
      ctx.logger.info('       dude up --build')
      ctx.logger.info('')
      ctx.logger.info('  Web UI: http://localhost:8080' + (withEntraId ? '' : '  (admin / admin)'))
      ctx.logger.info('  Example DAGs live in airflow/dags/examples/ — unpause them in the UI.')
      if (withIac) {
        ctx.logger.info('')
        ctx.logger.info('  Deploy to AWS ECS Fargate (Terraform) — see iac/README.md:')
        ctx.logger.info('       dude iac login --env dev')
        ctx.logger.info('       dude iac bootstrap --state-bucket-prefix <your-org> --env dev --yes')
        ctx.logger.info('       dude iac init --env dev && dude iac apply --env dev')
        ctx.logger.info('       dude iac migrate --env dev')
        ctx.logger.info('       dude iac ship --env dev')
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
    test: testCommand,
    docs: docsCommand,
    dag: dagCommands,
    iac: iacCommands,
  },
})
