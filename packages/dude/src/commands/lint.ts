import { defineCommand } from 'citty'
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { loadStack } from '../core/stack-loader.js'
import { runLint, formatDiagnostic } from '../core/lint/index.js'

export const lintCommand = defineCommand({
  meta: {
    name: 'lint',
    description: "Check project structure conventions using the stack's own rules.",
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

    // Read dude.json to discover which stack owns this project
    const dudeJsonPath = path.join(root, 'dude.json')
    if (!existsSync(dudeJsonPath)) {
      process.stderr.write(
        `error: dude.json not found in ${root}\n` +
          `Run \`dude init\` to scaffold the project first.\n`,
      )
      process.exit(1)
    }

    const dudeJson = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as { stack?: string }
    if (!dudeJson.stack) {
      process.stderr.write(`error: dude.json is missing the "stack" field.\n`)
      process.exit(1)
    }

    // Load the stack to resolve its root directory
    const { root: stackRoot } = await loadStack(dudeJson.stack, root)

    const { diagnostics, errorCount, warningCount } = await runLint(root, stackRoot)

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
