import type { StackCommandDef } from '@cubocicloide/dude'

/**
 * An IaC target (e.g. `aws-ecs`). Every provider implements the same canonical
 * command set (`login`, `new-env`, `bootstrap`, `init`, `plan`, `apply`,
 * `destroy`, `output`, `fmt`, `validate`, `build`, `push`, `deploy`, `ship`,
 * `create-site`, `migrate`, `status`, `logs`, `shell`) but owns its own
 * definitions under `providers/<id>/`. The active provider for a project is
 * chosen by `detect()`.
 */
export interface IacProvider {
  /** Stable id, matching the `iac` scaffold answer (e.g. `aws-ecs`). */
  id: string
  /** Human label for docs/help. */
  label: string
  /** True when this provider is the one configured for the project at `projectRoot`. */
  detect: (projectRoot: string) => boolean
  /** The provider's command implementations, keyed by canonical command name. */
  commands: Record<string, StackCommandDef>
}

/** The canonical IaC command names every provider is expected to implement. */
export const IAC_COMMAND_NAMES = [
  'login',
  'new-env',
  'bootstrap',
  'init',
  'plan',
  'apply',
  'destroy',
  'output',
  'fmt',
  'validate',
  'build',
  'push',
  'deploy',
  'ship',
  'create-site',
  'migrate',
  'status',
  'logs',
  'shell',
] as const
