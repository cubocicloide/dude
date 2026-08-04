import { defineCommand, runMain } from 'citty'
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { coreCommands, coreCommandNames } from './commands/help/index.js'
import { loadStack, stackLoadFailureMessage } from './core/stack-loader.js'
import { resolveCustomCommand } from './core/custom-commands.js'
import type { StackCommandDef } from './core/stack-contract.js'
import { getCliVersion } from './utils/paths.js'
import { satisfiesMinVersion } from './utils/semver.js'

// ---------------------------------------------------------------------------
// Core commands — stack-agnostic. Only commands that make sense for every
// possible stack regardless of technology. Stack-specific commands (up, down,
// logs, shell, lint, format, …) are defined by each stack plugin.
// ---------------------------------------------------------------------------

const main = defineCommand({
  meta: {
    name: 'dude',
    version: getCliVersion(),
    description: "Cubocicloide's project scaffolding & code quality CLI.",
  },
  // Derived from the single core-command registry in commands/help — see the note
  // there. Registering a command in two places is what let `version` and `help`
  // fall out of the published catalog.
  subCommands: coreCommands,
})

// ---------------------------------------------------------------------------
// Generic project-command dispatcher
//
// Precedence: project-custom > stack > core.
//
//   `.dude/commands/<cmd>.ts`  → project custom command       (highest)
//   `dude <cmd>`               → definition.commands[cmd]      (flat stack)
//   `dude <group> <sub>`       → definition.commands[group][sub] (grouped stack)
//
// A custom command overrides a stack command of the same name; a flat stack
// command overrides a core command of the same name.
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

async function tryProjectDispatch(): Promise<boolean> {
  const [, , first, second, ...rest] = process.argv
  if (!first || first.startsWith('-')) return false

  const cwd = process.cwd()
  const dudeJsonPath = path.join(cwd, 'dude.json')
  if (!existsSync(dudeJsonPath)) return false

  // Unguarded, a syntax error here took down EVERY command in the project with a
  // raw JSON SyntaxError — including the ones needed to fix it.
  let dudeJson: { stack?: string; stackVersion?: string }
  try {
    dudeJson = JSON.parse(readFileSync(dudeJsonPath, 'utf8'))
  } catch (e) {
    process.stderr.write(
      `error: dude.json could not be parsed.\n\n` +
        `  ${dudeJsonPath}\n` +
        `  ${e instanceof Error ? e.message : String(e)}\n\n` +
        `Fix the file — it records this project's stack and version pins. ` +
        `\`dude version\` and\n\`dude info\` work without it if you need to inspect the ` +
        `toolchain first.\n`,
    )
    process.exit(1)
  }

  // ── 1. Project-local custom commands (highest precedence) ──────────────────
  // Lazily resolve only the invoked name, so unrelated command modules are
  // never imported (and their top-level deps never executed).
  const custom = await resolveCustomCommand(cwd, first)
  if (custom?.def) {
    const argv = second !== undefined ? [second, ...rest] : []
    // Custom commands must work even if the stack can't load; stackRoot is a
    // best-effort convenience and falls back to the project root.
    let customStackRoot = cwd
    if (dudeJson.stack) {
      try {
        customStackRoot = (await loadStack(dudeJson.stack, cwd, dudeJson.stackVersion)).root
      } catch {
        // ignore — keep projectRoot as stackRoot
      }
    }
    await custom.def.run({ projectRoot: cwd, stackRoot: customStackRoot, args: parseRawArgs(argv) })
    return true
  }
  // If the user explicitly invoked a command whose file is unusable, fail
  // loudly with the reason instead of silently falling through. Reserved-name
  // clashes are excluded: there the file is ignored and the core/stack command
  // of that name must still run (e.g. `dude init` despite a stray init.ts).
  if (custom?.error && custom.error.kind !== 'reserved') {
    process.stderr.write(
      `error: custom command \`dude ${first}\` could not be loaded ` +
        `(.dude/commands/${custom.error.file}): ${custom.error.message}\n`,
    )
    process.exit(1)
  }

  // ── 2. Stack commands ──────────────────────────────────────────────────────
  if (!dudeJson.stack) return false

  // A stack's module body runs during this import, and it calls the helpers the
  // CLI exports (`defineLintCommand`, `defineDocsCommand`, …) while building its
  // `commands` map. So a stack newer than the running CLI fails *here* — before
  // the `minDudeVersion` gate below can report anything, and for every command
  // rather than only the one that needs the new API.
  //
  // Without this catch the user sees a raw ESM/TypeError trace from
  // `bin/dude.mjs`'s top-level handler. `minDudeVersion` cannot cover this case
  // by construction: reading it requires the import to have already succeeded.
  let definition: Awaited<ReturnType<typeof loadStack>>['definition']
  let stackRoot: string
  try {
    const loaded = await loadStack(dudeJson.stack, cwd, dudeJson.stackVersion)
    definition = loaded.definition
    stackRoot = loaded.root
  } catch (e) {
    const message = stackLoadFailureMessage(
      dudeJson.stack,
      dudeJson.stackVersion,
      getCliVersion(),
      e,
    )

    // Core commands must survive a broken stack — `dude upgrade` is the way out of
    // exactly this situation, so exiting here would strand the user with advice
    // they cannot follow. Warn and fall through to citty, which owns them. (A stack
    // may legitimately override a core command; that override is simply
    // unavailable while the stack cannot load.)
    if (coreCommandNames.includes(first)) {
      process.stderr.write(
        `warning: stack "${dudeJson.stack}" could not be loaded, so any stack\n` +
          `overrides are unavailable. Running the built-in \`dude ${first}\` instead.\n\n` +
          message,
      )
      return false
    }

    process.stderr.write(
      message +
        `\nCore commands (\`dude version\`, \`dude upgrade\`, \`dude info\`) do not need the\n` +
        `stack, so they remain available to fix this.\n`,
    )
    process.exit(1)
  }
  const entry = definition.commands?.[first]
  if (!entry) return false

  // Compatibility gate: refuse to run a stack command under a CLI older than the
  // stack requires. Core commands do reach this function, but they return above
  // (no stack entry of that name), and a stack that fails to load falls through
  // for them — so `dude upgrade`/`dude version` stay available to remediate.
  const cliVersion = getCliVersion()
  if (definition.minDudeVersion && !satisfiesMinVersion(cliVersion, definition.minDudeVersion)) {
    process.stderr.write(
      `error: stack "${dudeJson.stack}" requires dude >= ${definition.minDudeVersion}, ` +
        `but the running CLI is ${cliVersion}.\n` +
        `Upgrade with \`dude upgrade --cli\`, then \`pnpm install\`.\n`,
    )
    process.exit(1)
  }

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
  if (await tryProjectDispatch()) return
  return runMain(main)
}
