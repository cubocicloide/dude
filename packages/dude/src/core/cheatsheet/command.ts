/**
 * Shared `cheatsheet` command definition.
 *
 * Every stack exposes the same behaviour — render the project's answer-aware
 * quick reference — so it lives here once and stacks register it with just their
 * own wording, exactly as they do for `lint`:
 *
 *   // stacks/<stack>/src/index.ts
 *   import { defineCheatsheetCommand } from '@cubocicloide/dude'
 *   commands: {
 *     cheatsheet: defineCheatsheetCommand(),
 *   }
 *
 * Never hand-roll a per-stack cheatsheet: six renderers of the same page is the
 * duplication epic #113 exists to remove.
 */
import { writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '../stack-contract.js'
import { generateCheatsheet } from './index.js'

export interface CheatsheetCommandOptions {
  /** Command description shown by `dude help`. */
  description?: string
}

export function defineCheatsheetCommand(options: CheatsheetCommandOptions = {}): StackCommandDef {
  return {
    description:
      options.description ??
      "One dense reference for this project: the commands it actually has, the conventions `dude lint` enforces, and how to verify your work. Use --format json for tooling and coding agents.",
    args: {
      format: {
        type: 'string',
        description: 'Output format: `md` (default) or `json` for tooling and coding agents.',
        default: 'md',
      },
      out: {
        type: 'string',
        description: 'Write to this file instead of stdout (path relative to the project root).',
      },
    },
    async run({ projectRoot, args }) {
      const raw = String(args.format ?? 'md').toLowerCase()
      if (raw !== 'md' && raw !== 'json' && raw !== 'markdown') {
        process.stderr.write(`error: unknown --format "${raw}". Use \`md\` or \`json\`.\n`)
        process.exit(1)
      }
      const format = raw === 'json' ? 'json' : 'md'
      const rendered = await generateCheatsheet(projectRoot, format)

      const out = args.out ? String(args.out) : undefined
      if (out) {
        const target = path.isAbsolute(out) ? out : path.join(projectRoot, out)
        writeFileSync(target, rendered)
        process.stdout.write(`[cheatsheet] Wrote ${path.relative(projectRoot, target)}\n`)
        return
      }
      process.stdout.write(rendered)
    },
  }
}
