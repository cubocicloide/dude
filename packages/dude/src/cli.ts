import { defineCommand, runMain } from 'citty'
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { upCommand, downCommand, logsCommand, shellCommand } from './commands/docker/index.js'
import { initCommand } from './commands/init/index.js'
import { helpCommand } from './commands/help/index.js'
import { versionCommand } from './commands/version/index.js'
import { loadStack } from './core/stack-loader.js'
import type { StackCommandDef } from './core/stack-contract.js'
import { getCliVersion } from './utils/paths.js'

// ---------------------------------------------------------------------------
// Core commands — generic, stack-agnostic. A stack may override any of these
// by declaring its own command with the same name in StackDefinition.commands.
// ---------------------------------------------------------------------------

const main = defineCommand({
  meta: {
    name: 'dude',
    version: getCliVersion(),
    description: "Cubocicloide's project scaffolding & code quality CLI.",
  },
  subCommands: {
    version: versionCommand,
    help: helpCommand,
    init: initCommand,
    up: upCommand,
    down: downCommand,
    logs: logsCommand,
    shell: shellCommand,
  },
})

// ---------------------------------------------------------------------------
// Generic stack-command dispatcher
//
// Two shapes are supported (precedence: stack > core):
//
//   `dude <cmd>`            → definition.commands[cmd]              (flat)
//   `dude <group> <sub>`    → definition.commands[group][sub]       (grouped)
//
// A flat stack command with the same name as a core command overrides it.
// ---------------------------------------------------------------------------

function parseRawArgs(argv: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx !== -1) {
        result[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1)
      } else {
        const next = argv[i + 1]
        if (next !== undefined && !next.startsWith('-')) {
          result[arg.slice(2)] = next
          i++
        } else {
          result[arg.slice(2)] = true
        }
      }
    }
  }
  return result
}

function isCommandDef(v: unknown): v is StackCommandDef {
  return !!v && typeof v === 'object' && typeof (v as StackCommandDef).run === 'function'
}

async function tryStackDispatch(): Promise<boolean> {
  const [, , first, second, ...rest] = process.argv
  if (!first || first.startsWith('-')) return false

  const cwd = process.cwd()
  const dudeJsonPath = path.join(cwd, 'dude.json')
  if (!existsSync(dudeJsonPath)) return false

  const dudeJson = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as {
    stack?: string
    stackVersion?: string
  }
  if (!dudeJson.stack) return false

  const { definition, root: stackRoot } = await loadStack(
    dudeJson.stack,
    cwd,
    dudeJson.stackVersion,
  )
  const entry = definition.commands?.[first]
  if (!entry) return false

  // Flat: `dude <cmd>` — entry is a StackCommandDef itself
  if (isCommandDef(entry)) {
    const argv = second !== undefined ? [second, ...rest] : []
    await entry.run({ projectRoot: cwd, stackRoot, args: parseRawArgs(argv) })
    return true
  }

  // Grouped: `dude <group> <sub>` — entry is Record<string, StackCommandDef>
  if (!second || second.startsWith('-')) {
    process.stderr.write(
      `error: \`dude ${first}\` is a command group. Available: ${Object.keys(entry).join(', ')}\n`,
    )
    process.exit(1)
  }
  const sub = entry[second]
  if (!isCommandDef(sub)) {
    process.stderr.write(
      `error: stack "${dudeJson.stack}" does not provide \`dude ${first} ${second}\`.\n`,
    )
    process.exit(1)
  }
  await sub.run({ projectRoot: cwd, stackRoot, args: parseRawArgs(rest) })
  return true
}

export async function run(): Promise<void> {
  if (await tryStackDispatch()) return
  return runMain(main)
}
