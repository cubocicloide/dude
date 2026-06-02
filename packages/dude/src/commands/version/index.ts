import { defineCommand } from 'citty'
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { getCliVersion } from '../../utils/paths.js'

export const versionCommand = defineCommand({
  meta: {
    name: 'version',
    description: 'Print the dude CLI version (and stack version if inside a project).',
  },
  async run() {
    const cliVersion = getCliVersion()
    process.stdout.write(`dude ${cliVersion}\n`)

    const dudeJsonPath = path.join(process.cwd(), 'dude.json')
    if (!existsSync(dudeJsonPath)) return

    try {
      const manifest = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as {
        stack?: string
        stackVersion?: string
      }
      if (manifest.stack) {
        const stackLine = manifest.stackVersion
          ? `${manifest.stack}@${manifest.stackVersion}`
          : manifest.stack
        process.stdout.write(`stack  ${stackLine}\n`)
      }
    } catch {
      // not a valid dude.json — ignore
    }
  },
})
