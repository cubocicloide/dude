import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'pathe'
import { getCliVersion } from '../utils/paths.js'

/**
 * Shared environment-diagnostics logic used by `dude info` (prints it) and
 * `dude report` (embeds it in a bug report). Kept in core so the two commands
 * can never drift apart — the diagnostics a user pastes and the diagnostics a
 * report attaches are byte-for-byte identical.
 */

export interface DudeManifest {
  stack?: string
  stackVersion?: string
  dudeVersion?: string
  answers?: Record<string, unknown>
}

/** The npm scope prefix every stack package shares. */
const STACK_PREFIX = '@cubocicloide/stack-'

/** Read and parse the nearest `dude.json`, or null when absent/invalid. */
export function readManifest(cwd: string): DudeManifest | null {
  const p = path.join(cwd, 'dude.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as DudeManifest
  } catch {
    return null
  }
}

/**
 * Short stack id (e.g. `react-fastapi`) derived from the manifest's full
 * package name (`@cubocicloide/stack-react-fastapi`). Returns undefined when
 * not in a project. This id matches the `stack` dropdown values in the bug
 * report issue form and the `stack:<id>` label set.
 */
export function stackIdFromManifest(manifest: DudeManifest | null): string | undefined {
  if (!manifest?.stack) return undefined
  return manifest.stack.startsWith(STACK_PREFIX)
    ? manifest.stack.slice(STACK_PREFIX.length)
    : manifest.stack
}

/**
 * Best-effort version probe for an external tool. Returns the first line of its
 * `--version` output, or `not found` when the binary is missing / errors out.
 * Never throws.
 */
function probe(cmd: string, args: string[] = ['--version']): string {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 5000 })
    if (r.error || r.status !== 0) return 'not found'
    const line = (r.stdout || r.stderr).trim().split('\n')[0]?.trim()
    return line || 'unknown'
  } catch {
    return 'not found'
  }
}

/**
 * Render the environment diagnostics block — the content that goes *inside* the
 * ``` fence in `dude info`, without the fences. Includes OS, Node/pnpm/Docker,
 * the resolved CLI + stack versions, and the recorded scaffold answers. Never
 * throws — diagnostics must always produce a complete report.
 */
export function renderDiagnostics(cwd: string): string {
  const manifest = readManifest(cwd)
  const out: string[] = []

  out.push('dude info')
  out.push('')

  // ── Toolchain ────────────────────────────────────────────────────────────
  out.push(`CLI:     @cubocicloide/dude ${getCliVersion()}`)
  if (manifest?.stack) {
    const v = manifest.stackVersion ? `@${manifest.stackVersion}` : ''
    out.push(`Stack:   ${manifest.stack}${v}`)
    if (manifest.dudeVersion) out.push(`Pinned:  dude ${manifest.dudeVersion} (dude.json)`)
  } else {
    out.push(`Stack:   (not in a project — no dude.json found)`)
  }
  out.push('')

  // ── Environment ──────────────────────────────────────────────────────────
  out.push(`OS:      ${os.type()} ${os.release()} (${process.arch})`)
  out.push(`Node:    ${process.version}`)
  out.push(`pnpm:    ${probe('pnpm')}`)
  out.push(`Docker:  ${probe('docker')}`)
  out.push('')

  // ── Scaffold answers (provenance) ──────────────────────────────────────────
  if (manifest?.answers && Object.keys(manifest.answers).length > 0) {
    out.push(`Scaffold answers:`)
    for (const [k, val] of Object.entries(manifest.answers)) {
      out.push(`  ${k}: ${JSON.stringify(val)}`)
    }
  }

  return out.join('\n')
}
