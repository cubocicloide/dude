import { defineCommand, runMain } from 'citty'
import { initCommand } from './commands/init.js'
import { lintCommand } from './commands/lint.js'
import { getCliVersion } from './utils/paths.js'

const main = defineCommand({
  meta: {
    name: 'dude',
    version: getCliVersion(),
    description: "Cubocicloide's project scaffolding & code quality CLI.",
  },
  subCommands: {
    init: initCommand,
    lint: lintCommand,
  },
})

export function run(): Promise<void> {
  return runMain(main)
}
