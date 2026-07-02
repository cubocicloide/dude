import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { readText } from '../../helpers.js'

/**
 * FE011 — src/ipc/ layout: one flat .ts module per command domain plus an
 * index.ts barrel that re-exports every module. Pages and components import
 * from '@/ipc', never from a deep path.
 */
export default function check(root: string): RawDiagnostic[] {
  const ipcDir = path.join(root, 'src', 'ipc')
  if (!existsSync(ipcDir)) return []

  const diagnostics: RawDiagnostic[] = []
  const entries = readdirSync(ipcDir, { withFileTypes: true })

  const modules: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      diagnostics.push({
        file: path.join('src', 'ipc', entry.name),
        line: 1,
        col: 1,
        severity: 'warning',
        message: `src/ipc/ must stay flat — unexpected directory "${entry.name}". One .ts module per command domain.`,
      })
      continue
    }
    if (!entry.name.endsWith('.ts')) {
      diagnostics.push({
        file: path.join('src', 'ipc', entry.name),
        line: 1,
        col: 1,
        severity: 'warning',
        message: `Unexpected file "${entry.name}" in src/ipc/. Only .ts modules are allowed.`,
      })
      continue
    }
    if (entry.name !== 'index.ts') modules.push(entry.name.replace(/\.ts$/, ''))
  }

  const barrelFile = path.join(ipcDir, 'index.ts')
  if (!existsSync(barrelFile)) {
    diagnostics.push({
      file: path.join('src', 'ipc', 'index.ts'),
      line: 1,
      col: 1,
      severity: 'error',
      message: 'src/ipc/index.ts barrel is missing. It must re-export every ipc module.',
    })
    return diagnostics
  }

  const barrel = readText(barrelFile)
  for (const name of modules) {
    if (!barrel.includes(`from './${name}'`) && !barrel.includes(`from "./${name}"`)) {
      diagnostics.push({
        file: path.join('src', 'ipc', 'index.ts'),
        line: 1,
        col: 1,
        severity: 'error',
        message: `src/ipc/index.ts is missing a barrel export for "${name}"`,
      })
    }
  }
  return diagnostics
}
