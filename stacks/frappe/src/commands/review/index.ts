import { runLint, formatDiagnostic } from '@cubocicloide/dude'
import type { StackCommandDef } from '@cubocicloide/dude'
import { isDockerRunning } from '../_docker.js'
import { ruff } from '../format/index.js'

export const reviewCommand: StackCommandDef = {
  description: 'One-pass review: stack lint rules + ruff check (no autofix).',
  args: {},
  async run({ projectRoot, stackRoot }) {
    let failed = false

    process.stdout.write('── dude lint ─────────────────────────────────────\n')
    const { diagnostics, errorCount } = await runLint(projectRoot, stackRoot)
    for (const d of diagnostics) process.stdout.write(formatDiagnostic(d) + '\n')
    if (errorCount > 0) failed = true
    if (diagnostics.length === 0) process.stdout.write('No issues found.\n')

    process.stdout.write('\n── ruff check ────────────────────────────────────\n')
    if (!isDockerRunning()) {
      process.stderr.write('[review] Docker is not running — skipping ruff check.\n')
    } else if (ruff(projectRoot, ['check', '.']) !== 0) {
      failed = true
    }

    process.exit(failed ? 1 : 0)
  },
}
