import { defineCommand, runMain } from 'citty'
import { initCommand } from './commands/init.js'
import { getCliVersion } from './utils/paths.js'

const main = defineCommand({
  meta: {
    name: 'dude',
    version: getCliVersion(),
    description: "Cubocicloide's project scaffolding & code quality CLI.",
  },
  subCommands: {
    init: initCommand,
  },
})

export function run(): Promise<void> {
  return runMain(main)
}
