import path from 'pathe'
import { defineStack, renderTemplateTree } from '@cubocicloide/dude'
import {
  androidBuildCommand,
  androidDevCommand,
  androidInitCommand,
} from './commands/android/index.js'
import { buildCommand } from './commands/build/index.js'
import { devCommand } from './commands/dev/index.js'
import { docsCommand } from './commands/docs/index.js'
import { doctorCommand } from './commands/doctor/index.js'
import { formatCommand } from './commands/format/index.js'
import { iconCommand } from './commands/icon/index.js'
import { iosBuildCommand, iosDevCommand, iosInitCommand } from './commands/ios/index.js'
import { lintCommand } from './commands/lint/index.js'
import { reviewCommand } from './commands/review/index.js'
import { testCommand } from './commands/test/index.js'

export default defineStack({
  name: 'tauri',
  version: '0.1.0',
  minDudeVersion: '0.1.0',
  description: 'A Tauri 2 desktop app — React + Ant Design frontend, Rust backend.',

  variables: [
    {
      name: 'projectName',
      type: 'string',
      prompt: 'Project name',
      pattern: '^[a-z][a-z0-9-]*$',
      default: 'my-app',
    },
    {
      name: 'database',
      type: 'select',
      prompt: 'Local database',
      choices: ['none', 'sqlite'],
      default: 'none',
    },
  ],

  async scaffold(ctx) {
    const { answers, dest, stackRoot, dudeVersion, stackVersion } = ctx

    const withSqlite = answers.database === 'sqlite'

    // Bundle identifier segments must be alphanumeric on every platform we
    // target: Android package names forbid dashes, Apple bundle IDs forbid
    // underscores. Strip anything else from the project name.
    const safeName = String(answers.projectName ?? 'app').replace(/[^a-zA-Z0-9]/g, '')
    const bundleIdentifier = `com.${safeName || 'app'}.app`

    const data: Record<string, unknown> = {
      ...answers,
      withSqlite,
      bundleIdentifier,
      dudeVersion,
      stackVersion,
    }

    const templates = path.join(stackRoot, 'templates')

    // Base overlay — always applied. Conditional bits inside base `.hbs`
    // files are guarded with {{#if withSqlite}}.
    await renderTemplateTree({ src: path.join(templates, 'base'), dest, data })
    // SQLite overlay — adds the notes domain (Rust commands + ipc + page).
    if (withSqlite) {
      await renderTemplateTree({ src: path.join(templates, 'sqlite'), dest, data })
    }
  },

  hooks: {
    async postInit(ctx) {
      const name = String(ctx.answers.projectName ?? 'your-project')
      const { logger } = ctx
      logger.info('')
      logger.info('Next steps:')
      logger.info(`  1. cd ${name}`)
      logger.info('  2. pnpm install')
      logger.info('  3. dude doctor   # verify Rust + platform prerequisites')
      logger.info('  4. dude dev      # run the desktop app with hot-reload')
      logger.info('')
      logger.info('Useful commands: dude lint · dude test · dude build · dude docs · dude help')
    },
  },

  rules: [],

  commands: {
    dev: devCommand,
    build: buildCommand,
    doctor: doctorCommand,
    icon: iconCommand,
    lint: lintCommand,
    format: formatCommand,
    review: reviewCommand,
    test: testCommand,
    docs: docsCommand,
    android: {
      init: androidInitCommand,
      dev: androidDevCommand,
      build: androidBuildCommand,
    },
    ios: {
      init: iosInitCommand,
      dev: iosDevCommand,
      build: iosBuildCommand,
    },
  },
})
