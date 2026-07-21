import { promises as fs } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { analyzeElectronProject, ConversionValidationError } from './analyzer.js'

export const convertElectronCommand: StackCommandDef = {
  description:
    'Analyze a React/Vite Electron project and prepare the /convert-electron migration skill.',
  args: {
    source: {
      type: 'string',
      description: 'Electron project directory (absolute or relative to the Tauri project).',
      required: true,
    },
    json: {
      type: 'boolean',
      description: 'Print the complete analysis as JSON.',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    if (typeof args.source !== 'string' || !args.source.trim()) {
      process.stderr.write(
        'error: --source is required.\n\n' +
          '  dude convert electron --source path/to/electron-app\n\n',
      )
      process.exit(1)
    }

    try {
      const report = analyzeElectronProject(projectRoot, args.source)
      const cacheDir = path.join(projectRoot, '.dude', 'cache')
      const reportFile = path.join(cacheDir, 'electron-conversion.json')
      await fs.mkdir(cacheDir, { recursive: true })
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8')

      if (args.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n')
        return
      }

      process.stdout.write(
        '\nElectron project analyzed.\n' +
          `  Source:       ${report.source.root}\n` +
          `  Renderer:     ${report.renderer.kind} (${report.renderer.sourceDir})\n` +
          `  Main files:   ${report.entries.main.length}\n` +
          `  Preload files:${report.entries.preload.length}\n` +
          `  IPC findings: ${report.ipcChannels.length}\n` +
          `  Blockers:     ${report.blockers.length}\n` +
          `  Report:       ${reportFile}\n\n` +
          'Continue with the /convert-electron skill to perform the semantic migration.\n',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const prefix =
        error instanceof ConversionValidationError
          ? 'invalid conversion input'
          : 'conversion analysis failed'
      process.stderr.write(`error: ${prefix}: ${message}\n`)
      process.exit(1)
    }
  },
}
