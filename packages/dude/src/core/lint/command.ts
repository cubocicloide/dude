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
 *
 * `--format json` exists because the diagnostics were always structured
 * internally and only ever formatted away: an agent had to scrape prose to learn
 * what it broke. It emits the same data the human format renders, so the two can
 * never disagree, and pairs with `dude explain <CODE>` for the fix.
 */
import type { StackCommandDef } from '../stack-contract.js'
import { runLint } from './index.js'
import { formatDiagnostic } from './types.js'
import type { Diagnostic } from './types.js'

/**
 * Identifies the payload shape of `dude lint --format json`.
 *
 * Bump the version when the shape changes incompatibly, so a consumer can refuse
 * a payload it does not understand rather than silently misreading it.
 */
export const LINT_JSON_SCHEMA = 'dude.lint/v1'

/** Payload emitted by `dude lint --format json`. */
export interface LintJsonReport {
  schema: typeof LINT_JSON_SCHEMA
  /**
   * The diagnostics to show, already filtered by `--quiet`. Compare against
   * `errorCount`/`warningCount`, which are always the unfiltered totals — the
   * same split the human format uses, where `--quiet` hides warnings from the
   * listing but still counts them in the summary.
   */
  diagnostics: Array<Pick<Diagnostic, 'code' | 'severity' | 'file' | 'line' | 'col' | 'message'>>
  errorCount: number
  warningCount: number
  /** Non-fatal configuration remarks, e.g. a `lint.disable` entry matching no check. */
  notices: string[]
}

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
      format: {
        type: 'string',
        description:
          'Output format: `human` (default) or `json` for tooling and coding agents. JSON goes to stdout alone, so it is pipeable.',
        default: 'human',
      },
    },
    async run({ projectRoot, stackRoot, args }) {
      const rawFormat = String(args.format ?? 'human').toLowerCase()
      if (rawFormat !== 'human' && rawFormat !== 'json') {
        process.stderr.write(`error: unknown --format "${rawFormat}". Use \`human\` or \`json\`.\n`)
        process.exit(1)
      }
      const quiet = Boolean(args.quiet)
      const { diagnostics, errorCount, warningCount, notices } = await runLint(
        projectRoot,
        stackRoot,
      )

      const visible = quiet ? diagnostics.filter((d) => d.severity === 'error') : diagnostics

      if (rawFormat === 'json') {
        // Nothing but JSON on stdout: notices travel inside the payload rather
        // than to stderr, so the document is self-contained and the pipe is clean.
        const report: LintJsonReport = {
          schema: LINT_JSON_SCHEMA,
          diagnostics: visible.map((d) => ({
            code: d.code,
            severity: d.severity,
            file: d.file,
            line: d.line,
            col: d.col,
            message: d.message,
          })),
          errorCount,
          warningCount,
          notices,
        }
        process.stdout.write(JSON.stringify(report, null, 2) + '\n')
        if (errorCount > 0) process.exit(1)
        return
      }

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
