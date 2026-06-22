/**
 * AWS EKS IaC provider — Terraform (VPC + EKS + ECR + ALB controller + ACM +
 * external-dns) and a Helm chart for the application release.
 *
 * Layout: one command per folder under `commands/<name>/index.ts` (so
 * `dude iac apply` lives in `commands/apply/`), shared plumbing under `lib/`.
 *
 * Everything is environment-scoped via `--env` (default `dev`). State lives in
 * S3 + DynamoDB (see `iac/terraform/environments/<env>/backend.hcl`), so the
 * exact same commands work locally and in CI.
 */
import type { IacProvider } from '../../types.js'
import { iacApplyCommand } from './commands/apply/index.js'
import { iacBootstrapCommand } from './commands/bootstrap/index.js'
import { iacBuildCommand } from './commands/build/index.js'
import { iacDeployCommand } from './commands/deploy/index.js'
import { iacDestroyCommand } from './commands/destroy/index.js'
import { iacFmtCommand } from './commands/fmt/index.js'
import { iacInitCommand } from './commands/init/index.js'
import { iacKubeconfigCommand } from './commands/kubeconfig/index.js'
import { iacLoginCommand } from './commands/login/index.js'
import { iacNewEnvCommand } from './commands/new-env/index.js'
import { iacOutputCommand } from './commands/output/index.js'
import { iacPlanCommand } from './commands/plan/index.js'
import { iacPushCommand } from './commands/push/index.js'
import { iacShellCommand } from './commands/shell/index.js'
import { iacShipCommand } from './commands/ship/index.js'
import { iacStatusCommand } from './commands/status/index.js'
import { iacValidateCommand } from './commands/validate/index.js'
import { hasIac } from './lib/terraform.js'

export const awsEksProvider: IacProvider = {
  id: 'aws-eks',
  label: 'AWS EKS (Terraform + Helm)',
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
    kubeconfig: iacKubeconfigCommand,
    deploy: iacDeployCommand,
    ship: iacShipCommand,
    status: iacStatusCommand,
    shell: iacShellCommand,
  },
}
