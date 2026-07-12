import type { StackCommandDef } from '@cubocicloide/dude'
import { benchSh, shellQuote } from '../_docker.js'

export const benchCommand: StackCommandDef = {
  description:
    'Raw bench passthrough: everything after `dude bench` runs as `bench …` inside the bench container, e.g. `dude bench --site all migrate`.',
  args: {},
  async run() {
    // The generic flag parser would swallow bench's own flags, so read the
    // raw argv tail instead: [node, dude, "bench", ...benchArgs].
    const idx = process.argv.indexOf('bench')
    const benchArgs = idx === -1 ? [] : process.argv.slice(idx + 1)
    const line = benchArgs.map(shellQuote).join(' ')
    benchSh(`cd /home/frappe/frappe-bench && bench ${line}`)
  },
}
