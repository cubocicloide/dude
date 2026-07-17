import { defineCommand } from 'citty'
import { renderDiagnostics } from '../../core/diagnostics.js'

export const infoCommand = defineCommand({
  meta: {
    name: 'info',
    description:
      'Print an environment diagnostics report (OS, Node/pnpm/Docker, dude + stack ' +
      'versions, scaffold answers). Paste it into a bug report.',
  },
  async run() {
    const body = renderDiagnostics(process.cwd())
    process.stdout.write('```\n' + body + '\n```\n')
  },
})
