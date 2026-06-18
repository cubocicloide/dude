import { defineCommand } from 'citty'
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { initCommand } from '../init/index.js'
import { upgradeCommand } from '../upgrade/index.js'
import { loadStack } from '../../core/stack-loader.js'
import { loadCustomCommands } from '../../core/custom-commands.js'
import type { StackCommandDef, StackCommandArg } from '../../core/stack-contract.js'
import { getCliVersion } from '../../utils/paths.js'

// ── Internal representations ───────────────────────────────────────────────────

interface ArgInfo {
  name: string
  type: 'string' | 'boolean' | 'positional'
  description: string
  default?: string | boolean
  required?: boolean
}

interface CmdInfo {
  name: string
  description: string
  args: ArgInfo[]
}

interface GroupInfo {
  name: string
  subs: CmdInfo[]
}

interface Catalog {
  flat: Map<string, CmdInfo>
  groups: Map<string, GroupInfo>
  /** Project-local custom commands (.dude/commands/), highest precedence. */
  custom: Map<string, CmdInfo>
}

// ── Extract info from a citty CommandDef ──────────────────────────────────────

type AnyCittyArg = {
  type?: string
  description?: string
  default?: unknown
  required?: boolean
}
type AnyCittyCmdDef = {
  meta?: { description?: string }
  args?: Record<string, AnyCittyArg>
}

function fromCittyDef(name: string, def: AnyCittyCmdDef): CmdInfo {
  const args: ArgInfo[] = []
  for (const [argName, argDef] of Object.entries(def.args ?? {})) {
    args.push({
      name: argName,
      type: (argDef.type ?? 'string') as ArgInfo['type'],
      description: argDef.description ?? '',
      default: argDef.default as string | boolean | undefined,
      required: argDef.required,
    })
  }
  return { name, description: def.meta?.description ?? '', args }
}

// ── Extract info from a StackCommandDef ───────────────────────────────────────

function fromStackCmd(name: string, def: StackCommandDef): CmdInfo {
  const args: ArgInfo[] = []
  for (const [argName, argDef] of Object.entries(def.args ?? {})) {
    args.push({
      name: argName,
      type: argDef.type as ArgInfo['type'],
      description: argDef.description ?? '',
      default: argDef.default,
      required: (argDef as StackCommandArg & { required?: boolean }).required,
    })
  }
  return { name, description: def.description, args }
}

function isStackCommandDef(v: unknown): v is StackCommandDef {
  return !!v && typeof v === 'object' && typeof (v as StackCommandDef).run === 'function'
}

// ── Build merged catalog ───────────────────────────────────────────────────────

function buildCoreCatalog(): Catalog {
  const flat = new Map<string, CmdInfo>()
  const groups = new Map<string, GroupInfo>()
  const custom = new Map<string, CmdInfo>()

  const coreCmds: [string, AnyCittyCmdDef][] = [
    ['init', initCommand as AnyCittyCmdDef],
    ['upgrade', upgradeCommand as AnyCittyCmdDef],
  ]
  for (const [name, def] of coreCmds) flat.set(name, fromCittyDef(name, def))
  return { flat, groups, custom }
}

/** A command is visible unless it declares an `available` predicate that fails. */
function isAvailable(def: StackCommandDef, projectRoot: string): boolean {
  if (typeof def.available !== 'function') return true
  try {
    return def.available(projectRoot)
  } catch {
    // A faulty predicate must never crash help — treat as unavailable.
    return false
  }
}

function mergeStackInto(
  catalog: Catalog,
  commands: Record<string, StackCommandDef | Record<string, StackCommandDef>>,
  projectRoot: string,
): void {
  for (const [key, value] of Object.entries(commands)) {
    if (isStackCommandDef(value)) {
      // Flat command — overrides any core command with the same name. Hidden
      // when its availability predicate fails for this project.
      if (isAvailable(value, projectRoot)) catalog.flat.set(key, fromStackCmd(key, value))
    } else if (value && typeof value === 'object') {
      // Group of sub-commands — keep only the available ones, drop empty groups.
      const group: GroupInfo = { name: key, subs: [] }
      for (const [subKey, subDef] of Object.entries(value)) {
        if (isStackCommandDef(subDef) && isAvailable(subDef, projectRoot)) {
          group.subs.push(fromStackCmd(subKey, subDef))
        }
      }
      if (group.subs.length > 0) catalog.groups.set(key, group)
    }
  }
}

function mergeCustomInto(catalog: Catalog, commands: Map<string, StackCommandDef>): void {
  for (const [name, def] of commands) {
    catalog.custom.set(name, fromStackCmd(name, def))
  }
}

/** A custom command "overrides" when it shadows a core/stack command name. */
function isOverride(catalog: Catalog, name: string): boolean {
  return catalog.flat.has(name) || catalog.groups.has(name)
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

const COL_WIDTH = 28

function col(text: string): string {
  return text.length >= COL_WIDTH ? text + ' ' : text.padEnd(COL_WIDTH)
}

/** Turn a kebab-case flag name into a short value placeholder: min-severity → severity */
function valueLabel(name: string): string {
  const parts = name.split('-')
  return parts[parts.length - 1] ?? name
}

function renderArgLine(arg: ArgInfo): string {
  let name: string
  if (arg.type === 'positional') {
    name = arg.required ? `<${arg.name}>` : `[<${arg.name}>]`
  } else if (arg.type === 'boolean') {
    name = `--${arg.name}`
  } else {
    name = `--${arg.name} <${valueLabel(arg.name)}>`
  }

  const desc = arg.description
  // Only append default if it's not already mentioned in the description.
  const needsDefault =
    arg.default !== undefined && arg.default !== false && !desc.toLowerCase().includes('default:')
  const suffix = needsDefault ? ` Default: ${String(arg.default)}.` : ''
  const required = arg.required ? ' Required.' : ''

  return `    ${col(name)}${desc}${suffix}${required}`
}

// ── Overview renderer ──────────────────────────────────────────────────────────

function renderOverview(catalog: Catalog, stackName?: string): void {
  const version = getCliVersion()
  const stackSuffix = stackName ? `  ─  ${stackName} stack` : ''
  const out: string[] = []

  out.push(`dude v${version}${stackSuffix}`)
  out.push('')

  if (catalog.flat.size > 0) {
    out.push('COMMANDS')
    for (const cmd of catalog.flat.values()) {
      out.push(`  ${col(cmd.name)}${cmd.description}`)
    }
  }

  if (catalog.groups.size > 0) {
    out.push('')
    out.push('COMMAND GROUPS')
    for (const group of catalog.groups.values()) {
      out.push(`  ${group.name}`)
      for (const sub of group.subs) {
        out.push(`    ${col(sub.name)}${sub.description}`)
      }
    }
  }

  if (catalog.custom.size > 0) {
    out.push('')
    out.push('PROJECT COMMANDS  (.dude/commands/)')
    for (const cmd of catalog.custom.values()) {
      const tag = isOverride(catalog, cmd.name) ? '  (overrides default)' : ''
      out.push(`  ${col(cmd.name)}${cmd.description}${tag}`)
    }
  }

  out.push('')
  out.push('Run `dude help <command>` or `dude help <group> <sub>` for flags.')
  out.push('')

  process.stdout.write(out.join('\n'))
}

// ── Detailed command renderer ──────────────────────────────────────────────────

function renderCmd(cmd: CmdInfo, qualifier = ''): void {
  const heading = qualifier ? `dude ${qualifier} ${cmd.name}` : `dude ${cmd.name}`
  const out: string[] = []
  out.push('')
  out.push(heading)
  out.push('')
  out.push(cmd.description)

  if (cmd.args.length > 0) {
    out.push('')
    out.push('FLAGS / ARGS')
    for (const arg of cmd.args) out.push(renderArgLine(arg))
  }

  out.push('')
  process.stdout.write(out.join('\n'))
}

function renderNotFound(tokens: string[]): void {
  process.stderr.write(
    `error: no command found for \`dude ${tokens.join(' ')}\`.\nRun \`dude help\` to list all commands.\n`,
  )
  process.exit(1)
}

// ── Help command ───────────────────────────────────────────────────────────────

export const helpCommand = defineCommand({
  meta: {
    name: 'help',
    description:
      'Show available commands and their flags. Merges core commands, the active ' +
      'stack, and project-local commands (.dude/commands/). Precedence: custom > stack > core.',
  },
  async run() {
    const cwd = process.cwd()
    const dudeJsonPath = path.join(cwd, 'dude.json')

    // ── Build catalog ──────────────────────────────────────────────────────────
    const catalog = buildCoreCatalog()
    let stackName: string | undefined

    if (existsSync(dudeJsonPath)) {
      try {
        const dudeJson = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as {
          stack?: string
          stackVersion?: string
        }
        if (dudeJson.stack) {
          stackName = dudeJson.stack
          const { definition } = await loadStack(dudeJson.stack, cwd, dudeJson.stackVersion)
          if (definition.commands) mergeStackInto(catalog, definition.commands, cwd)
        }
      } catch {
        // best-effort; fall back to core-only
      }

      // Project-local custom commands are part of every project, independent of
      // whether the stack loaded. Surface load errors so a broken file is visible.
      const custom = await loadCustomCommands(cwd)
      mergeCustomInto(catalog, custom.commands)
      for (const e of custom.errors) {
        process.stderr.write(`warning: .dude/commands/${e.file} ignored — ${e.message}\n`)
      }
    }

    // ── Route to overview or specific command ──────────────────────────────────
    // `process.argv` after 'help': everything the user typed after the word 'help'.
    const afterHelp = process.argv.slice(3).filter((t) => !t.startsWith('-'))

    if (afterHelp.length === 0) {
      renderOverview(catalog, stackName)
      return
    }

    const [first, second] = afterHelp as [string, string | undefined]

    if (!second) {
      // `dude help <cmd>` — custom (highest precedence), then flat, then group
      const customCmd = catalog.custom.get(first ?? '')
      if (customCmd) {
        renderCmd(customCmd)
        return
      }
      const flatCmd = catalog.flat.get(first ?? '')
      if (flatCmd) {
        renderCmd(flatCmd)
        return
      }
      const group = catalog.groups.get(first ?? '')
      if (group) {
        // Print all sub-commands in the group with their flags
        for (const sub of group.subs) renderCmd(sub, first)
        return
      }
      renderNotFound([first ?? ''])
    } else {
      // `dude help <group> <sub>`
      const group = catalog.groups.get(first ?? '')
      const sub = group?.subs.find((s) => s.name === second)
      if (sub) {
        renderCmd(sub, first)
        return
      }
      renderNotFound([first ?? '', second])
    }
  },
})
