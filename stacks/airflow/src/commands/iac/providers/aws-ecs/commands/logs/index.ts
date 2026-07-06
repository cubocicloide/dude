/**
 * `dude iac logs` — tail the deployment's CloudWatch logs.
 *
 * Implemented on top of `aws logs filter-log-events` (not `aws logs tail`,
 * which only exists in AWS CLI v2 — filter-log-events works on v1 and v2
 * alike). Every Airflow container logs to one group with stream names
 * `airflow/<component>/<task-id>`, so `--service scheduler` narrows the tail
 * to one component via the stream-name prefix.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, projectName, sleepMs } from '../../../../shared.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveProfile,
  tfOutputRaw,
  tfvarsValue,
} from '../../lib/terraform.js'

/** The container names of the deployment — valid values for --service. */
const SERVICES = ['api-server', 'scheduler', 'dag-processor', 'triggerer', 'worker', 'migrate']

/** Parse "15m" / "2h" / "1d" / "90s" into milliseconds. */
function parseSince(s: string): number | null {
  const m = /^(\d+)\s*([smhd])$/.exec(s.trim())
  if (!m) return null
  const n = Number(m[1])
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd']
  return n * unit
}

interface LogEvent {
  eventId?: string
  timestamp?: number
  message?: string
  logStreamName?: string
}

/** One filter-log-events sweep from `startTime`, following pagination. */
function fetchEvents(
  group: string,
  streamPrefix: string | null,
  startTime: number,
  regionFlag: string[],
  projectRoot: string,
  profile: string,
): { events: LogEvent[]; ok: boolean } {
  const events: LogEvent[] = []
  let nextToken: string | undefined
  // Pagination backstop — a single sweep never needs more than a few pages.
  for (let page = 0; page < 20; page++) {
    const cliArgs = [
      'logs',
      'filter-log-events',
      '--log-group-name',
      group,
      '--start-time',
      String(startTime),
      '--output',
      'json',
      ...regionFlag,
    ]
    if (streamPrefix) cliArgs.push('--log-stream-name-prefix', streamPrefix)
    if (nextToken) cliArgs.push('--next-token', nextToken)

    const r = capture('aws', cliArgs, projectRoot, profile)
    if (r.status !== 0) return { events, ok: false }
    try {
      const parsed = JSON.parse(r.stdout) as { events?: LogEvent[]; nextToken?: string }
      events.push(...(parsed.events ?? []))
      if (!parsed.nextToken) break
      nextToken = parsed.nextToken
    } catch {
      return { events, ok: false }
    }
  }
  return { events, ok: true }
}

function printEvent(e: LogEvent): void {
  const ts = e.timestamp ? new Date(e.timestamp).toISOString().slice(11, 19) : '--:--:--'
  // Stream names look like airflow/<component>/<task-id> — the component is
  // the part worth showing.
  const component = e.logStreamName?.split('/')[1] ?? e.logStreamName ?? '?'
  process.stdout.write(`${ts}  [${component}]  ${(e.message ?? '').trimEnd()}\n`)
}

export const iacLogsCommand: StackCommandDef = {
  available: hasIac,
  description:
    "Tail the deployment's CloudWatch logs (all components, or one via --service).",
  args: {
    ...envArg,
    service: {
      type: 'string',
      description: `Only this component: ${SERVICES.join(', ')}.`,
      required: false,
    },
    since: {
      type: 'string',
      description: 'How far back to start (e.g. 90s, 15m, 2h, 1d). Default: 15m.',
    },
    follow: { type: 'boolean', description: 'Keep streaming new log events (like tail -f).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    const group =
      tfOutputRaw(projectRoot, 'log_group', profile) || `/ecs/${projectName(projectRoot)}-${env}`
    const region =
      tfOutputRaw(projectRoot, 'region', profile) || tfvarsValue(projectRoot, env, 'region')
    const regionFlag = region ? ['--region', region] : []

    let streamPrefix: string | null = null
    if (typeof args.service === 'string' && args.service) {
      if (!SERVICES.includes(args.service)) {
        process.stderr.write(
          `\n  ✗  unknown --service "${args.service}" (expected one of: ${SERVICES.join(', ')}).\n\n`,
        )
        process.exit(1)
      }
      streamPrefix = `airflow/${args.service}/`
    }

    const sinceMs = parseSince(String(args.since ?? '15m'))
    if (sinceMs == null) {
      process.stderr.write('\n  ✗  invalid --since (expected e.g. 90s, 15m, 2h, 1d).\n\n')
      process.exit(1)
    }

    let startTime = Date.now() - sinceMs
    const seen = new Set<string>()
    let firstSweep = true

    for (;;) {
      const { events, ok } = fetchEvents(group, streamPrefix, startTime, regionFlag, projectRoot, profile)
      if (!ok && firstSweep) {
        process.stderr.write(
          `\n  ✗  Could not read log group "${group}".\n` +
            `     Is the environment provisioned (dude iac apply --env ${env}) and your AWS auth valid (dude iac login --env ${env})?\n\n`,
        )
        process.exit(1)
      }
      firstSweep = false

      events.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      for (const e of events) {
        const id = e.eventId ?? `${e.logStreamName}:${e.timestamp}:${e.message}`
        if (seen.has(id)) continue
        seen.add(id)
        printEvent(e)
        if (e.timestamp && e.timestamp >= startTime) startTime = e.timestamp
      }
      // Keep the dedupe window small: only ids at the boundary matter.
      if (seen.size > 10_000) seen.clear()

      if (!args.follow) break
      sleepMs(5000)
    }
  },
}
