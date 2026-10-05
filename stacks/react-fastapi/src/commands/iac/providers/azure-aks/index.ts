/**
 * Azure AKS IaC provider — Terraform (resource group + VNet + AKS + ACR +
 * ingress-nginx, optional PostgreSQL Flexible Server) and a Helm chart for the
 * application release.
 *
 * Layout mirrors the AWS provider exactly: one command per folder under
 * `commands/<name>/index.ts` (so `dude iac apply` lives in `commands/apply/`),
 * shared plumbing under `lib/`. The command names and their meanings are the
 * canonical set every provider implements — only what they wrap differs.
 *
 * Everything is environment-scoped via `--env` (required, no default). State
 * lives in an Azure Storage blob container (which also provides the state lock,
 * via a blob lease), so the exact same commands work locally and in CI.
 *
 * The app is published on Azure's own `*.cloudapp.azure.com` hostname: the
 * ingress Service asks the cloud-controller for a DNS label, so no domain
 * registration or DNS delegation is needed anywhere in this flow.
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
import { PROVIDER_ID, hasIac } from './lib/terraform.js'

export const azureAksProvider: IacProvider = {
  id: PROVIDER_ID,
  label: 'Azure AKS (Terraform + Helm)',
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
