/**
 * Shared `lint` command definition.
 *
 * Every stack exposes the same lint behavior — run the engine, print colored
 * diagnostics, exit non-zero on errors — so the command lives here once and
 * stacks register it with just their own wording:
 *
 *   // stacks/<stack>/src/commands/lint/index.ts
 *   import { defineLintCommand } from '@cubocicloide/dude'
 *   export const lintCommand = defineLintCommand({
 *     description: "Check project structure conventions using the stack's own rules.",
 *   })
 *
 * The engine (`runLint`) already merges stack checks with project checks from
 * `.dude/lint/checks/` and honors `lint.disable` in dude.json, so any stack
 * using this helper supports project-defined rules for free.
 */
import type { StackCommandDef } from '../stack-contract.js'
import { runLint } from './index.js'
import { formatDiagnostic } from './types.js'

export interface LintCommandOptions {
  /** Command description shown by `dude help`. */
  description?: string
}

export function defineLintCommand(options: LintCommandOptions = {}): StackCommandDef {
  return {
    description:
      options.description ?? "Check project structure conventions using the stack's own rules.",
    args: {
      quiet: {
        type: 'boolean',
        description: 'Suppress warnings; only show errors.',
        default: false,
      },
    },
    async run({ projectRoot, stackRoot, args }) {
      const quiet = Boolean(args.quiet)
      const { diagnostics, errorCount, warningCount, notices } = await runLint(
        projectRoot,
        stackRoot,
      )

      const visible = quiet ? diagnostics.filter((d) => d.severity === 'error') : diagnostics
      const isTTY = process.stdout.isTTY
      const colorize = (s: string, severity: string) =>
        isTTY ? (severity === 'error' ? `\x1b[31m${s}\x1b[0m` : `\x1b[33m${s}\x1b[0m`) : s

      for (const d of visible) {
        process.stdout.write(colorize(formatDiagnostic(d), d.severity) + '\n')
      }

      for (const notice of notices) {
        process.stderr.write(`notice: ${notice}\n`)
      }

      if (errorCount === 0 && warningCount === 0) {
        process.stdout.write('No issues found.\n')
        return
      }

      const summary = [
        errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : '',
        warningCount > 0 ? `${warningCount} warning${warningCount > 1 ? 's' : ''}` : '',
      ]
        .filter(Boolean)
        .join(', ')
      process.stderr.write(`\n${summary}\n`)
      if (errorCount > 0) process.exit(1)
    },
  }
}
