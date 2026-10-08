/**
 * Reading the deployed Container Apps of an environment.
 *
 * `status` and `logs` ask Azure what exists rather than deriving the list from
 * the scaffold answers. The set of apps depends on how the project was
 * scaffolded (a Celery worker only when `--celery`, a beat scheduler only when
 * `--celerybeat`, Redis only when either), and a command that guessed would
 * either miss one or offer a service that was never deployed.
 */
import { capture } from './exec.js'

export interface ContainerApp {
  name: string
  runningStatus: string
  latestRevision: string
  fqdn: string
  replicas: number
}

/** Every container app in the environment's resource group, name-sorted. */
export function listApps(
  projectRoot: string,
  resourceGroup: string,
  subscription?: string,
): ContainerApp[] {
  const r = capture(
    'az',
    ['containerapp', 'list', '--resource-group', resourceGroup, '--output', 'json'],
    projectRoot,
    subscription,
  )
  if (r.status !== 0) return []
  try {
    const raw = JSON.parse(r.stdout) as Array<Record<string, unknown>>
    return raw
      .map((a) => {
        const props = (a.properties ?? {}) as Record<string, unknown>
        const cfg = (props.configuration ?? {}) as Record<string, unknown>
        const ingress = (cfg.ingress ?? {}) as Record<string, unknown>
        const template = (props.template ?? {}) as Record<string, unknown>
        const scale = (template.scale ?? {}) as Record<string, unknown>
        return {
          name: String(a.name ?? ''),
          runningStatus: String(props.runningStatus ?? '—'),
          latestRevision: String(props.latestRevisionName ?? '—'),
          fqdn: String(ingress.fqdn ?? ''),
          replicas: Number(scale.minReplicas ?? 0),
        }
      })
      .filter((a) => a.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

/**
 * Resolve a `--service` flag to a deployed app name. Accepts both the short
 * name (`backend`) and the full one (`my-app-dev-backend`), because the short
 * form is what the docs use and the full form is what `status` prints.
 */
export function resolveApp(apps: ContainerApp[], wanted: string): ContainerApp | undefined {
  return (
    apps.find((a) => a.name === wanted) ??
    apps.find((a) => a.name.endsWith(`-${wanted}`))
  )
}
