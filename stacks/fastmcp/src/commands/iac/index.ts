/**
 * `dude iac …` — Infrastructure-as-Code command group.
 *
 * The IaC target is chosen at scaffold time (`--iac aws-ecs`). Every target is
 * a self-contained provider under `providers/<id>/` implementing the same
 * canonical command set; this module only registers the providers and exposes
 * the active one's command map.
 *
 * Adding a new target (e.g. `gcp-cloud-run`):
 *   1. create `providers/<id>/` mirroring `providers/aws-ecs/`,
 *   2. export its `IacProvider` from `providers/<id>/index.ts`,
 *   3. add it to `iacProviders` below,
 *   4. add the `<id>` choice to the stack's `iac` scaffold variable + overlay.
 *
 * The stack module is imported with `process.cwd()` set to the user's project
 * root, so the active provider can be resolved eagerly here. Each command also
 * guards with its own `available`/`requireIac`, so nothing runs for a project
 * that wasn't scaffolded with that target.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import type { IacProvider } from './types.js'
import { awsEcsProvider } from './providers/aws-ecs/index.js'

/** All known IaC providers. Register new targets here. */
export const iacProviders: IacProvider[] = [awsEcsProvider]

/** The provider configured for the project at `projectRoot`, if any. */
export function activeIacProvider(projectRoot: string = process.cwd()): IacProvider | undefined {
  return iacProviders.find((p) => p.detect(projectRoot))
}

/**
 * The `dude iac` command group. Resolved from the project's configured
 * provider; falls back to the first provider so `dude help` still lists the
 * commands when run outside a project — each command's `available` predicate
 * hides them when no IaC target is configured.
 */
const provider = activeIacProvider() ?? iacProviders[0]
export const iacCommands: Record<string, StackCommandDef> = provider?.commands ?? {}
