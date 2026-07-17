import path from 'pathe'
import { defineStack, renderTemplateTree } from '@cubocicloide/dude'
import { docsCommand } from './commands/docs/index.js'
import { downCommand } from './commands/down/index.js'
import { formatCommand } from './commands/format/index.js'
import { iacCommands } from './commands/iac/index.js'
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
  name: 'fastmcp',
  version: '0.1.0',
  minDudeVersion: '0.1.0',
  description: 'A FastMCP (Python) server — modular monolith of MCP feature sub-servers.',

  variables: [
    {
      name: 'projectName',
      type: 'string',
      prompt: 'Project name',
      pattern: '^[a-z][a-z0-9-]*$',
      default: 'my-mcp',
    },
    {
      name: 'iac',
      type: 'select',
      prompt: 'Infrastructure-as-Code (Terraform, AWS ECS Fargate)',
      choices: ['none', 'aws-ecs'],
      default: 'none',
    },
  ],

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion, stackVersion } = ctx

    const withIac = answers.iac === 'aws-ecs'

    const data: Record<string, unknown> = {
      ...answers,
      withIac,
      dudeVersion,
      stackVersion,
    }

    const templates = path.join(stackRoot, 'templates')

    // Base template — always rendered. The stack ships a single Python service,
    // so the only conditional overlay is the IaC one.
    await renderTemplateTree({ src: path.join(templates, 'base'), dest, data })

    // IaC overlay — Terraform for ECS Fargate + ALB, the production Dockerfile,
    // the IaC runner and the deploy docs page.
    if (withIac) {
      await renderTemplateTree({ src: path.join(templates, 'aws-ecs'), dest, data })
    }
  },

  hooks: {
    async postInit(ctx) {
      const name = String(ctx.answers.projectName ?? 'your-project')
      const withIac = ctx.answers.iac === 'aws-ecs'

      ctx.logger.info('Project scaffolded. Next steps:')
      ctx.logger.info('')
      ctx.logger.info('  1. Install the dude launcher once (globally), then provision the project:')
      ctx.logger.info('       npm install -g @cubocicloide/dude-launcher')
      ctx.logger.info(`       cd ${name} && pnpm install`)
      ctx.logger.info('     From now on `dude <cmd>` runs this project’s pinned CLI + stack.')
      ctx.logger.info('')
      ctx.logger.info('  2. Start the server (streamable HTTP):')
      ctx.logger.info('       dude up --build')
      ctx.logger.info('')
      ctx.logger.info('  3. Explore it with the MCP Inspector (dev profile):')
      ctx.logger.info('       docker compose --profile dev up --build')
      ctx.logger.info('       # open http://localhost:6274 → Streamable HTTP → http://fastmcp:8000/mcp/')
      ctx.logger.info('')
      ctx.logger.info('  Endpoints:')
      ctx.logger.info('    MCP server: http://localhost:8000/mcp/')
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
    iac: iacCommands,
  },
})
