import { defineCommand } from '@cubocicloide/dude'

export default defineCommand({
  description: 'Example project-local greeting command.',
  args: {
    name: { type: 'string', default: 'world', description: 'Who to greet.' },
  },
  async run({ args }) {
    process.stdout.write(`Hello, ${String(args.name ?? 'world')}!\n`)
  },
})
