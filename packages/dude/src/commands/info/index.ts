import { defineCommand } from 'citty'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'pathe'
import { getCliVersion } from '../../utils/paths.js'

/**
 * Best-effort version probe for an external tool. Returns the first line of its
 * `--version` output, or `not found` when the binary is missing / errors out.
 * Never throws — `dude info` must always produce a complete report.
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

interface DudeManifest {
  stack?: string
  stackVersion?: string
  dudeVersion?: string
  answers?: Record<string, unknown>
}

/** Read and parse the nearest `dude.json`, or null when absent/invalid. */
function readManifest(cwd: string): DudeManifest | null {
  const p = path.join(cwd, 'dude.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as DudeManifest
  } catch {
    return null
  }
}

export const infoCommand = defineCommand({
  meta: {
    name: 'info',
    description:
      'Print an environment diagnostics report (OS, Node/pnpm/Docker, dude + stack ' +
      'versions, scaffold answers). Paste it into a bug report.',
  },
  async run() {
    const cwd = process.cwd()
    const manifest = readManifest(cwd)

    const out: string[] = []
    out.push('```')
    out.push(`dude info`)
    out.push('')

    // ── Toolchain ──────────────────────────────────────────────────────────
    out.push(`CLI:     @cubocicloide/dude ${getCliVersion()}`)
    if (manifest?.stack) {
      const v = manifest.stackVersion ? `@${manifest.stackVersion}` : ''
      out.push(`Stack:   ${manifest.stack}${v}`)
      if (manifest.dudeVersion) out.push(`Pinned:  dude ${manifest.dudeVersion} (dude.json)`)
    } else {
      out.push(`Stack:   (not in a project — no dude.json found)`)
    }
    out.push('')

    // ── Environment ────────────────────────────────────────────────────────
    out.push(`OS:      ${os.type()} ${os.release()} (${process.arch})`)
    out.push(`Node:    ${process.version}`)
    out.push(`pnpm:    ${probe('pnpm')}`)
    out.push(`Docker:  ${probe('docker')}`)
    out.push('')

    // ── Scaffold answers (provenance) ────────────────────────────────────────
    if (manifest?.answers && Object.keys(manifest.answers).length > 0) {
      out.push(`Scaffold answers:`)
      for (const [k, val] of Object.entries(manifest.answers)) {
        out.push(`  ${k}: ${JSON.stringify(val)}`)
      }
    }

    out.push('```')
    process.stdout.write(out.join('\n') + '\n')
  },
})
