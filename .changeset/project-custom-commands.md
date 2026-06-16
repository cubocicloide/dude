---
"@cubocicloide/dude": minor
"@cubocicloide/stack-react-fastapi": minor
---

Add project-local custom commands under `.dude/commands/`.

Any scaffolded project can now define its own `dude` commands by dropping a file
in `.dude/commands/` — one file per command, named after the file (`reset.ts` →
`dude reset`). No registration step.

**@cubocicloide/dude**
- New `defineCommand` helper exported from the package for authoring custom
  commands with full type-checking.
- Custom commands are loaded with [jiti](https://github.com/unjs/jiti), so they
  can be written in TypeScript and `import` any package installed in the project
  (imports resolve against the project's own `node_modules`). `.mjs`/`.js` work too.
- Dispatch precedence is **custom > stack > core**: a `.dude/commands/up.ts`
  overrides the stack's `up`. The dispatch hot path lazily loads only the invoked
  command, so unrelated command modules are never imported.
- The core commands `init`, `upgrade`, `version`, and `help` are reserved and
  cannot be overridden.
- `dude help` shows custom commands under a **PROJECT COMMANDS** section and
  marks overrides; load/validation failures surface as warnings.

**@cubocicloide/stack-react-fastapi**
- Scaffold ships a `.dude/commands/` directory with a `hello` example command
  and a `README.md` documenting the full contract.
