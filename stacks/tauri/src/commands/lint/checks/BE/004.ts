import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { readText } from '../../helpers.js'

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/
const MOD_DECL_RE = /^\s*(?:pub\s+)?mod\s+([a-zA-Z0-9_]+)\s*;/gm

/**
 * BE004 — commands/ module hygiene: every command file is snake_case and
 * declared in commands/mod.rs, and every `mod` declaration has a matching file.
 */
export default function check(root: string): RawDiagnostic[] {
  const commandsDir = path.join(root, 'src-tauri', 'src', 'commands')
  const modFile = path.join(commandsDir, 'mod.rs')
  if (!existsSync(commandsDir) || !existsSync(modFile)) return []

  const diagnostics: RawDiagnostic[] = []

  const moduleFiles = readdirSync(commandsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.rs') && e.name !== 'mod.rs')
    .map((e) => e.name.replace(/\.rs$/, ''))

  const modContent = readText(modFile)
  const declared = new Set<string>()
  for (const m of modContent.matchAll(MOD_DECL_RE)) declared.add(m[1]!)

  for (const name of moduleFiles) {
    if (!SNAKE_CASE.test(name)) {
      diagnostics.push({
        file: path.join('src-tauri', 'src', 'commands', `${name}.rs`),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Command module "${name}.rs" must be snake_case.`,
      })
    }
    if (!declared.has(name)) {
      diagnostics.push({
        file: path.join('src-tauri', 'src', 'commands', 'mod.rs'),
        line: 1,
        col: 1,
        severity: 'error',
        message: `commands/mod.rs is missing the declaration "pub mod ${name};".`,
      })
    }
  }
  for (const name of declared) {
    if (!moduleFiles.includes(name)) {
      diagnostics.push({
        file: path.join('src-tauri', 'src', 'commands', 'mod.rs'),
        line: 1,
        col: 1,
        severity: 'error',
        message: `commands/mod.rs declares "mod ${name};" but commands/${name}.rs does not exist.`,
      })
    }
  }
  return diagnostics
}
