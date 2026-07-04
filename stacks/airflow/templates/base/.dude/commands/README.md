# Custom `dude` commands

Drop a file in this directory and it becomes a `dude` command. The command name
is the file's base name:

```
.dude/commands/reset.ts   →   dude reset
.dude/commands/seed.ts    →   dude seed
```

No registration step — this directory **is** the registry.

## Writing a command

Each file must `export default` a command object. Use the `defineCommand` helper
from `@cubocicloide/dude` (already a dev dependency of this project) for full
type-checking and autocomplete:

```ts
import { defineCommand } from '@cubocicloide/dude'

export default defineCommand({
  description: 'Reset the database to a clean state.',
  args: {
    force: { type: 'boolean', description: 'Skip the confirmation prompt.' },
  },
  async run({ projectRoot, args }) {
    // your logic here
  },
})
```

### The command context

`run()` receives:

| Field         | Description                                              |
| ------------- | -------------------------------------------------------- |
| `projectRoot` | Absolute path to this project (where `dude.json` lives). |
| `stackRoot`   | Absolute path to the installed stack package.            |
| `args`        | Parsed flags, keyed by the names you declare in `args`.  |

### Arguments

Each entry in `args` declares a flag of `type: 'string'` or `type: 'boolean'`,
with an optional `description` and `default`. They show up in `dude help <cmd>`.

## TypeScript & extra packages

Commands are loaded with [jiti](https://github.com/unjs/jiti), so you can write
real TypeScript and `import` any package you add to the project:

```bash
pnpm add -D execa
```

```ts
import { defineCommand } from '@cubocicloide/dude'
import { execa } from 'execa'

export default defineCommand({
  description: 'Tail the backend logs.',
  async run() {
    await execa('docker', ['compose', 'logs', '-f', 'backend'], { stdio: 'inherit' })
  },
})
```

`.mjs` and `.js` files work too.

## Overriding built-in commands

A custom command overrides a stack command of the same name. For example, a
`.dude/commands/up.ts` replaces the default `dude up`. Overrides are marked in
`dude help`.

The core commands `init`, `upgrade`, `version`, and `help` are reserved and
cannot be overridden.

## Listing your commands

```bash
dude help            # shows a "PROJECT COMMANDS" section
dude help <command>  # shows a command's flags
```
