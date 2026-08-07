import path from 'pathe'
import {
  defineStack,
  renderTemplateTree,
  defineCheatsheetCommand,
  defineDocsCommand,
  defineExplainCommand,
} from '@cubocicloide/dude'
import { newAppCommand, installAppCommand } from './commands/app/index.js'
import { benchCommand } from './commands/bench/index.js'
import { downCommand } from './commands/down/index.js'
import { formatCommand } from './commands/format/index.js'
import { iacCommands } from './commands/iac/index.js'
import { lintCommand } from './commands/lint/index.js'
import { logsCommand } from './commands/logs/index.js'
import { reviewCommand } from './commands/review/index.js'
import { shellCommand } from './commands/shell/index.js'
import {
  backupCommand,
  clearCacheCommand,
  consoleCommand,
  mariadbCommand,
  migrateCommand,
} from './commands/site/index.js'
import { testCommand } from './commands/test/index.js'
import { upCommand } from './commands/up/index.js'

export default defineStack({
  name: 'frappe',
  version: '0.1.0',
  minDudeVersion: '0.1.0',
  description:
    'Frappe Framework ticketing system (Frappe Helpdesk) with a worked-example custom app.',

  variables: [
    {
      name: 'projectName',
      type: 'string',
      prompt: 'Project name',
      pattern: '^[a-z][a-z0-9-]*$',
      default: 'my-helpdesk',
    },
    {
      name: 'helpdesk',
      type: 'boolean',
      prompt: 'Install Frappe Helpdesk (the ticketing UI)?',
      default: true,
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
      'A Frappe Framework ticketing system (Frappe Helpdesk) with a worked custom-app example and optional AWS ECS Fargate IaC.',
    useCases: [
      'A ticketing/helpdesk system running Frappe Helpdesk out of the box',
      "A team learning Frappe's core building blocks via a worked custom-app example",
      'A DocType/workflow-driven backend with a straightforward path to AWS ECS Fargate',
    ],
    technologies: ['Frappe Framework', 'Frappe Helpdesk', 'MariaDB'],
    iac: { provider: 'aws-ecs', flag: '--iac aws-ecs' },
    pages: [
      { file: 'index.md', title: 'Home' },
      { file: 'frappe.md', title: 'Frappe core concepts' },
      { file: 'extending.md', title: 'Extending the app' },
      { file: 'dude.md', title: 'Working with dude' },
      { file: 'api.md', title: 'Command reference' },
      { file: 'cheatsheet.md', title: 'Cheatsheet' },
      { file: 'mkdocs.md', title: 'Writing docs' },
      { file: 'deploy.md', title: 'Deploy (AWS ECS)', when: 'withIac' },
    ],
  },

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion, stackVersion } = ctx

    const withHelpdesk = answers.helpdesk !== false
    const withIac = answers.iac === 'aws-ecs'

    const data: Record<string, unknown> = {
      ...answers,
      withHelpdesk,
      withIac,
      dudeVersion,
      stackVersion,
    }

    const templates = path.join(stackRoot, 'templates')

    // Base template — always rendered. Ships the dockerised bench (MariaDB +
    // Redis + frappe/bench), the `ticketing` example app and the docs.
    await renderTemplateTree({ src: path.join(templates, 'base'), dest, data })

    // IaC overlay — Terraform for AWS ECS Fargate (ALB, RDS MariaDB,
    // ElastiCache, EFS), the production image and the deploy docs.
    if (withIac) {
      await renderTemplateTree({ src: path.join(templates, 'aws-ecs'), dest, data })
    }
  },

  hooks: {
    async postInit(ctx) {
      const name = String(ctx.answers.projectName ?? 'your-project')
      const withHelpdesk = ctx.answers.helpdesk !== false
      const withIac = ctx.answers.iac === 'aws-ecs'

      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  1. Install the dude launcher once (globally), then provision the project:')
      ctx.logger.info('       npm install -g @cubocicloide/dude-launcher')
      ctx.logger.info(`       cd ${name} && pnpm install`)
      ctx.logger.info('     From now on `dude <cmd>` runs this project’s pinned CLI + stack.')
      ctx.logger.info('')
      ctx.logger.info('  2. Start the stack — the FIRST boot creates the bench, the site and')
      ctx.logger.info('     installs the apps, which takes several minutes:')
      ctx.logger.info('       dude up')
      ctx.logger.info('       dude logs --service bench   # watch the provisioning')
      ctx.logger.info('')
      ctx.logger.info('  Endpoints (once `bench start` is running):')
      ctx.logger.info(`    Desk (admin):   http://${name}.localhost:8000/app  (Administrator / admin)`)
      if (withHelpdesk) {
        ctx.logger.info(`    Helpdesk:       http://${name}.localhost:8000/helpdesk`)
      }
      ctx.logger.info(`    Portal example: http://${name}.localhost:8000/ticket_stats`)
      ctx.logger.info(`    API example:    http://${name}.localhost:8000/api/method/ticketing.api.ticket_stats`)
      ctx.logger.info('')
      ctx.logger.info('  Learn Frappe with this repo: apps/ticketing/README.md maps every core')
      ctx.logger.info('  concept (DocType, hooks, tasks, workflow, portal page) to a file.')
      if (withIac) {
        ctx.logger.info('')
        ctx.logger.info('  Deploy to AWS ECS Fargate (Terraform) — see iac/README.md:')
        ctx.logger.info('       dude iac login --env dev')
        ctx.logger.info('       dude iac bootstrap --state-bucket-prefix <your-org> --env dev --yes')
        ctx.logger.info('       dude iac init --env dev && dude iac apply --env dev')
        ctx.logger.info('       dude iac ship --env dev')
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
    bench: benchCommand,
    lint: lintCommand,
    format: formatCommand,
    review: reviewCommand,
    test: testCommand,
    docs: defineDocsCommand(),
    site: {
      migrate: migrateCommand,
      console: consoleCommand,
      backup: backupCommand,
      'clear-cache': clearCacheCommand,
      mariadb: mariadbCommand,
    },
    app: {
      new: newAppCommand,
      install: installAppCommand,
    },
    iac: iacCommands,
  },
})
