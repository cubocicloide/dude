/**
 * Shared `explain` command definition.
 *
 * The other half of `dude lint --format json`: lint says *which* rule broke and
 * where, `dude explain <CODE>` says *why it exists and how to fix it*. Together
 * they close the loop for an agent, which previously had to guess which prose
 * file corresponded to a diagnostic — or read the whole `.claude/rules/` tree and
 * hope.
 *
 * Stacks register it, they never hand-roll it:
 *
 *   // stacks/<stack>/src/index.ts
 *   import { defineExplainCommand } from '@cubocicloide/dude'
 *   commands: {
 *     explain: defineExplainCommand(),
 *   }
 *
 * Codes come from `discoverCheckCodes` — the engine's own discovery — so this
 * command can only ever explain a rule that actually runs here. A code disabled
 * via `dude.json` is still explainable, but says so: you may well be reading it
 * to decide whether to switch it back on.
 */
import path from 'pathe'
import type { StackCommandDef } from '../stack-contract.js'
import { discoverCheckCodes } from './index.js'
import { readRuleDoc, ruleTitle } from './rules.js'

export interface ExplainCommandOptions {
  /** Command description shown by `dude help`. */
  description?: string
}

export function defineExplainCommand(options: ExplainCommandOptions = {}): StackCommandDef {
  return {
    description:
      options.description ??
      'Print the prose behind a lint rule — what `dude lint` flagged, why it exists, and how to fix it.',
    args: {
      code: {
        type: 'positional',
        description: 'The diagnostic code to explain, e.g. `BE003`. Case-insensitive.',
        required: false,
      },
    },
    async run({ projectRoot, stackRoot, args }) {
      const { codes, disabled } = discoverCheckCodes(projectRoot, stackRoot)

      const requested = args.code === undefined ? '' : String(args.code).trim().toUpperCase()
      if (!requested) {
        // No argument is a discovery request, not an error: list what can be
        // explained rather than making the user guess a code to find out.
        if (codes.length === 0) {
          process.stderr.write('No lint rules are defined for this project.\n')
          process.exit(1)
        }
        process.stdout.write('Usage: dude explain <CODE>\n\nKnown codes:\n')
        for (const c of codes) {
          const title = ruleTitle(readRuleDoc(projectRoot, c))
          const flags = [c.source === 'project' ? 'project' : null, disabled.has(c.code) ? 'disabled' : null]
            .filter(Boolean)
            .join(', ')
          process.stdout.write(`  ${c.code}${flags ? ` (${flags})` : ''} — ${title}\n`)
        }
        return
      }

      const match = codes.find((c) => c.code === requested)
      if (!match) {
        process.stderr.write(
          `error: unknown lint code "${requested}".\n\nKnown codes: ${
            codes.length > 0 ? codes.map((c) => c.code).join(', ') : '(none defined for this project)'
          }\n`,
        )
        process.exit(1)
        return
      }

      const doc = readRuleDoc(projectRoot, match)
      if (!doc.content) {
        // Name the path rather than saying "undocumented" — for a project rule
        // that path is exactly where the author should write the file, and for a
        // stack rule its absence is a real parity bug worth being able to report.
        process.stderr.write(
          `error: ${match.code} has no prose file.\n\nExpected it at: ${path.relative(projectRoot, doc.path)}\n` +
            (match.source === 'project'
              ? 'Create that file to document your project rule — see .dude/lint/checks/README.md.\n'
              : 'This is a stack packaging bug: every stack rule ships a matching rules file.\n'),
        )
        process.exit(1)
        return
      }

      if (disabled.has(match.code)) {
        process.stderr.write(
          `notice: ${match.code} is disabled in dude.json (lint.disable) and will not run here.\n`,
        )
      }
      process.stdout.write(doc.content.endsWith('\n') ? doc.content : doc.content + '\n')
    },
  }
}
