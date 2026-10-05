/**
 * Azure Container Apps IaC provider — Terraform only: a resource group, a VNet,
 * a Container Apps environment, one container app per service, an Azure
 * Container Registry (shared, from the bootstrap) and an optional PostgreSQL
 * Flexible Server.
 *
 * It implements the same canonical command set as the other targets, minus
 * `kubeconfig` (there is no cluster to point a kubeconfig at) and plus `logs`
 * and `migrate` — the two things a Kubernetes user would reach for kubectl to
 * do. Twelve of the commands are the shared Azure implementations bound to this
 * target; the rest live here because they depend on how Container Apps runs and
 * releases an application.
 *
 * Everything is environment-scoped via `--env` (required, no default). State
 * lives in an Azure Storage blob container (whose lease is also the state lock),
 * so the exact same commands work locally and in CI.
 *
 * The app is published on the environment's own `*.azurecontainerapps.io`
 * hostname, with a Microsoft-managed TLS certificate — so it is reachable over
 * **HTTPS** with no domain registration, no DNS delegation and no certificate
 * authority involved anywhere in this flow.
 */
import type { IacProvider } from '../../types.js'
import { iacApplyCommand } from './commands/apply/index.js'
import { iacBootstrapCommand } from './commands/bootstrap/index.js'
import { iacBuildCommand } from './commands/build/index.js'
import { iacDeployCommand } from './commands/deploy/index.js'
import { iacDestroyCommand } from './commands/destroy/index.js'
import { iacFmtCommand } from './commands/fmt/index.js'
import { iacInitCommand } from './commands/init/index.js'
import { iacLogsCommand } from './commands/logs/index.js'
import { iacLoginCommand } from './commands/login/index.js'
import { iacMigrateCommand } from './commands/migrate/index.js'
import { iacNewEnvCommand } from './commands/new-env/index.js'
import { iacOutputCommand } from './commands/output/index.js'
import { iacPlanCommand } from './commands/plan/index.js'
import { iacPushCommand } from './commands/push/index.js'
import { iacShellCommand } from './commands/shell/index.js'
import { iacShipCommand } from './commands/ship/index.js'
import { iacStatusCommand } from './commands/status/index.js'
import { iacValidateCommand } from './commands/validate/index.js'
import { PROVIDER_ID, hasIac } from './lib/terraform.js'

export const azureAcaProvider: IacProvider = {
  id: PROVIDER_ID,
  label: 'Azure Container Apps (Terraform)',
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
    migrate: iacMigrateCommand,
    shell: iacShellCommand,
  },
}
