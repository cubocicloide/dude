/**
 * Project-local custom commands.
 *
 * A scaffolded project may define its own `dude` commands under
 * `.dude/commands/`. Each file is one command; the command name is the file's
 * base name (`reset.ts` → `dude reset`). No registration step — the directory
 * is the registry, mirroring the lint-check auto-discovery convention.
 *
 * Files are loaded through **jiti**, so users can author real TypeScript and
 * `import` any extra packages they install in the project (jiti resolves those
 * imports against the project's own `node_modules`). `.mjs`/`.js` work too.
 *
 * Precedence at dispatch time is custom > stack > core: a `.dude/commands/up.ts`
 * overrides the stack's `up`. Core commands (init, upgrade, version, help) are
 * reserved and cannot be overridden — overriding `init`/`help` inside a project
 * would be meaningless or harmful.
 */
import { existsSync, readdirSync } from 'node:fs'
import { resolve, join, basename, extname } from 'pathe'
import { createJiti } from 'jiti'
import type { StackCommandDef } from './stack-contract.js'

/** Directory (relative to the project root) scanned for custom commands. */
export const CUSTOM_COMMANDS_DIR = '.dude/commands'

/** File extensions jiti can load as a command module. */
const LOADABLE = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'])

/** Core command names a project command may not shadow. */
const RESERVED = new Set(['init', 'upgrade', 'version', 'help'])

export interface CustomCommandError {
  /** File name (relative to the commands dir) that failed to load. */
  file: string
  /** Command name the file would have provided (its base name). */
  name: string
  /**
   * Why the file was rejected. `reserved` means the name shadows a core
   * command and the file is simply ignored (the core command still works);
   * the others mean the command itself is unusable.
   */
  kind: 'reserved' | 'duplicate' | 'load' | 'invalid'
  /** Human-readable reason. */
  message: string
}

export interface LoadCustomResult {
  /** Valid commands keyed by name. */
  commands: Map<string, StackCommandDef>
  /** Files that were rejected, with the reason why. */
  errors: CustomCommandError[]
}

/**
 * Validate a loaded module's default export against the StackCommandDef shape.
 * Returns the typed def or a reason string — never throws.
 */
function validate(mod: unknown): { def?: StackCommandDef; error?: string } {
  const candidate =
    mod && typeof mod === 'object' && 'default' in mod
      ? (mod as { default: unknown }).default
      : mod

  if (!candidate || typeof candidate !== 'object') {
    return { error: 'must `export default` a command object (use `defineCommand({ ... })`)' }
  }
  const def = candidate as Partial<StackCommandDef>

  if (typeof def.description !== 'string' || def.description.trim() === '') {
    return { error: 'missing a non-empty `description` string' }
  }
  if (typeof def.run !== 'function') {
    return { error: 'missing a `run` function' }
  }
  if (def.args !== undefined) {
    if (typeof def.args !== 'object' || def.args === null) {
      return { error: '`args` must be an object' }
    }
    for (const [argName, argDef] of Object.entries(def.args)) {
      const t = (argDef as { type?: unknown })?.type
      if (t !== 'string' && t !== 'boolean') {
        return { error: `arg "${argName}" must declare type 'string' or 'boolean'` }
      }
    }
  }
  return { def: def as StackCommandDef }
}

/** Loadable command files in `.dude/commands/`, sorted for deterministic order. */
function listCommandFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && LOADABLE.has(extname(e.name)) && !e.name.endsWith('.d.ts'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
}

/** Import one file through jiti and validate it. Never throws. */
async function loadOne(
  jiti: { import: (id: string) => Promise<unknown> },
  file: string,
): Promise<{ def?: StackCommandDef; kind?: 'load' | 'invalid'; message?: string }> {
  let mod: unknown
  try {
    mod = await jiti.import(file)
  } catch (err) {
    return { kind: 'load', message: err instanceof Error ? err.message : String(err) }
  }
  const { def, error } = validate(mod)
  if (!def) return { kind: 'invalid', message: error ?? 'invalid command definition' }
  return { def }
}

/**
 * Discover and load *all* custom commands for a project — used by `dude help`
 * to render the full PROJECT COMMANDS section.
 *
 * Never throws: load/parse failures and contract violations are collected in
 * `errors`. Returns an empty result when `.dude/commands/` is absent or empty.
 */
export async function loadCustomCommands(projectRoot: string): Promise<LoadCustomResult> {
  const dir = resolve(projectRoot, CUSTOM_COMMANDS_DIR)
  const result: LoadCustomResult = { commands: new Map(), errors: [] }
  const files = listCommandFiles(dir)
  if (files.length === 0) return result

  // jiti resolves the command files' own imports against the project's
  // node_modules, so user-installed packages are available to commands.
  const jiti = createJiti(projectRoot)

  // base name → file, to detect collisions across extensions (reset.ts + reset.mjs)
  const claimed = new Map<string, string>()

  for (const file of files) {
    const name = basename(file, extname(file))

    if (RESERVED.has(name)) {
      result.errors.push({ file, name, kind: 'reserved', message: reservedMessage(name) })
      continue
    }
    const prior = claimed.get(name)
    if (prior) {
      result.errors.push({
        file,
        name,
        kind: 'duplicate',
        message: `duplicate command name "${name}" (already defined by ${prior})`,
      })
      continue
    }

    const { def, kind, message } = await loadOne(jiti, join(dir, file))
    if (!def) {
      result.errors.push({ file, name, kind: kind ?? 'invalid', message: message ?? 'invalid' })
      continue
    }

    claimed.set(name, file)
    result.commands.set(name, def)
  }

  return result
}

/**
 * Resolve a *single* custom command by name — the dispatch hot path. Only the
 * matching file is imported, so invoking `dude up` never executes (or even
 * transpiles) unrelated command modules like `reset.ts`.
 *
 * Returns `{ def }` on success, `{ error }` when the matching file is reserved
 * or fails to load, or `null` when no file claims that name.
 */
export async function resolveCustomCommand(
  projectRoot: string,
  name: string,
): Promise<{ def?: StackCommandDef; error?: CustomCommandError } | null> {
  const dir = resolve(projectRoot, CUSTOM_COMMANDS_DIR)
  const files = listCommandFiles(dir)
  // First file (alphabetical) whose base name matches — same winner as the full
  // loader, so dispatch and help agree on collisions.
  const file = files.find((f) => basename(f, extname(f)) === name)
  if (!file) return null

  if (RESERVED.has(name)) {
    return { error: { file, name, kind: 'reserved', message: reservedMessage(name) } }
  }

  const jiti = createJiti(projectRoot)
  const { def, kind, message } = await loadOne(jiti, join(dir, file))
  if (!def) {
    return { error: { file, name, kind: kind ?? 'invalid', message: message ?? 'invalid' } }
  }
  return { def }
}

function reservedMessage(name: string): string {
  return `"${name}" is a reserved core command and cannot be overridden`
}
