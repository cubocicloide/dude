/**
 * AWS ECS IaC provider — Terraform only: a minimal public VPC, an internet-
 * facing ALB (SSE-friendly idle timeout, health check on `/health`), and an
 * ECS Fargate service running the single FastMCP container, with the image in
 * a shared ECR repository.
 *
 * Layout: one command per folder under `commands/<name>/index.ts` (so
 * `dude iac apply` lives in `commands/apply/`), shared plumbing under `lib/`.
 *
 * Everything is environment-scoped via `--env` (required, no default). State
 * lives in S3 + DynamoDB (see `iac/terraform/environments/<env>/backend.hcl`),
 * so the exact same commands work locally and in CI.
 */
import type { IacProvider } from '../../types.js'
import { iacApplyCommand } from './commands/apply/index.js'
import { iacBootstrapCommand } from './commands/bootstrap/index.js'
import { iacBuildCommand } from './commands/build/index.js'
import { iacDeployCommand } from './commands/deploy/index.js'
import { iacDestroyCommand } from './commands/destroy/index.js'
import { iacFmtCommand } from './commands/fmt/index.js'
import { iacInitCommand } from './commands/init/index.js'
import { iacLoginCommand } from './commands/login/index.js'
import { iacLogsCommand } from './commands/logs/index.js'
import { iacNewEnvCommand } from './commands/new-env/index.js'
import { iacOutputCommand } from './commands/output/index.js'
import { iacPlanCommand } from './commands/plan/index.js'
import { iacPushCommand } from './commands/push/index.js'
import { iacShellCommand } from './commands/shell/index.js'
import { iacShipCommand } from './commands/ship/index.js'
import { iacStatusCommand } from './commands/status/index.js'
import { iacValidateCommand } from './commands/validate/index.js'
import { hasIac } from './lib/terraform.js'

export const awsEcsProvider: IacProvider = {
  id: 'aws-ecs',
  label: 'AWS ECS Fargate (Terraform)',
  detect: hasIac,
  commands: {
    login: iacLoginCommand,
    'new-env': iacNewEnvCommand,
    bootstrap: iacBootstrapCommand,
    init: iacInitCommand,
    plan: iacPlanCommand,
    apply: iacApplyCommand,
    destroy: iacDestroyCommand,
    output: iacOutputCommand,
    fmt: iacFmtCommand,
    validate: iacValidateCommand,
    build: iacBuildCommand,
    push: iacPushCommand,
    deploy: iacDeployCommand,
    ship: iacShipCommand,
    status: iacStatusCommand,
    logs: iacLogsCommand,
    shell: iacShellCommand,
  },
}
