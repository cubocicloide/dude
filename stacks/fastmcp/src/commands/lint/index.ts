import { runLint, formatDiagnostic, type StackCommandDef } from '@cubocicloide/dude'

export const lintCommand: StackCommandDef = {
  description: "Check project structure conventions using the stack's own rules.",
  args: {
    quiet: { type: 'boolean', description: 'Suppress warnings; only show errors.', default: false },
  },
  async run({ projectRoot, stackRoot, args }) {
    const quiet = Boolean(args.quiet)
    const { diagnostics, errorCount, warningCount } = await runLint(projectRoot, stackRoot)

    const visible = quiet ? diagnostics.filter((d) => d.severity === 'error') : diagnostics
    const isTTY = process.stdout.isTTY
    const colorize = (s: string, severity: string) =>
      isTTY ? (severity === 'error' ? `\x1b[31m${s}\x1b[0m` : `\x1b[33m${s}\x1b[0m`) : s

    for (const d of visible) {
      process.stdout.write(colorize(formatDiagnostic(d), d.severity) + '\n')
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
