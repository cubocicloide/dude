/**
 * Example custom command — `dude hello`.
 *
 * This file is a starting point: rename it, edit it, or delete it. Every file
 * under `.dude/commands/` becomes a `dude` command named after the file
 * (`hello.ts` → `dude hello`). See `.dude/commands/README.md` for the full
 * contract.
 */
import { defineCommand } from '@cubocicloide/dude'

export default defineCommand({
  description: 'Example custom command — prints a greeting.',
  args: {
    name: {
      type: 'string',
      description: 'Who to greet.',
      default: 'world',
    },
    shout: {
      type: 'boolean',
      description: 'Greet in uppercase.',
    },
  },
  // `projectRoot` is the absolute path to this project; `args` holds the parsed
  // flags above. You can import any package you add to the project here.
  async run({ projectRoot, args }) {
    const name = typeof args.name === 'string' ? args.name : 'world'
    let message = `Hello, ${name}! 👋`
    if (args.shout) message = message.toUpperCase()

    process.stdout.write(message + '\n')
    process.stdout.write(`(running in ${projectRoot})\n`)
  },
})
