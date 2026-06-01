import { defineCommand } from 'citty'
import path from 'pathe'
import { runLint, formatDiagnostic } from '../core/lint/index.js'

export const lintCommand = defineCommand({
  meta: {
    name: 'lint',
    description: 'Check project structure conventions (FE001-FE007, BE001-BE004).',
  },
  args: {
    root: {
      type: 'positional',
      description: 'Project root to lint (defaults to current directory).',
      required: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress warnings; only show errors.',
      default: false,
    },
  },
  async run({ args }) {
    const root = path.resolve(args.root ?? process.cwd())
    const { diagnostics, errorCount, warningCount } = await runLint(root)

    const visible = args.quiet ? diagnostics.filter((d) => d.severity === 'error') : diagnostics

    for (const d of visible) {
      process.stdout.write(formatDiagnostic(d) + '\n')
    }

    if (errorCount === 0 && warningCount === 0) {
      process.stdout.write('No issues found.\n')
      process.exit(0)
    }

    const summary = [
      errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : '',
      warningCount > 0 ? `${warningCount} warning${warningCount > 1 ? 's' : ''}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    process.stderr.write(`\n${summary}\n`)
    process.exit(errorCount > 0 ? 1 : 0)
  },
})
