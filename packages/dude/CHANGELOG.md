# @cubocicloide/dude

## 0.9.0

### Minor Changes

- 2633e97: Add project-local custom commands under `.dude/commands/`.

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
  - PostgreSQL projects additionally get `dude reset` (drop DB → restart services →
    migrate → seed demo data) as a ready-to-use custom command under `.dude/commands/`.

## 0.8.0

### Minor Changes

- 7c1bb4d: Add global launcher, lockfile-backed version pinning, and OpenAPI pre-generation at init.

  **@cubocicloide/dude-launcher** (new package)
  Global shim installed once per machine (`npm i -g @cubocicloide/dude-launcher`). Walks up to the nearest `dude.json`, ensures the project's pinned CLI + stack are installed via the project's package manager, then re-execs `node_modules/.bin/dude`. Works from any subdirectory; `DUDE_SKIP_PROVISION` escape hatch for CI.

  **@cubocicloide/dude**
  - CLI and stack are now both pinned as exact `devDependencies` in the scaffolded `package.json` (lockfile-enforced); the `~/.dude` cache is a fallback only for `dude init` on bare machines.
  - `dude upgrade --stack` now updates `package.json` and `dude.json` in lockstep.
  - `minDudeVersion` declared by each stack is now enforced at runtime before any stack command runs.
  - New `satisfiesMinVersion` semver utility.
  - `StackContext` gains `stackVersion` so Handlebars templates can reference `{{stackVersion}}`.

  **@cubocicloide/stack-react-fastapi**
  - `dude init` pre-generates the full typed OpenAPI client from the bundled `openapi.yaml` template, making `dude api sync` a no-op until backend routes actually change.
  - `dude format` and `dude review` now invoke prettier/ESLint via `node_modules/.bin/` directly, avoiding pnpm workspace detection issues when the project root carries `@cubocicloide/...` devDependencies.
  - `scaffold()` passes `stackVersion` to Handlebars data so `package.json.hbs` can pin the correct stack version.

## 0.7.0

### Minor Changes

- afdb915: Add `dude upgrade` to update pinned CLI and stack versions in existing projects, and document the upgrade and rollback workflow in the stack and project docs.

## 0.6.1

### Patch Changes

- a1c9b91: Update README and template docs with first-run guide, full service URL table (Swagger UI, ReDoc, Flower), and hot reload instructions

## 0.6.0

### Minor Changes

- 77a06b3: Add YAML frontmatter to .claude agents and skills; migrate rules from applyTo to paths key
- cdff3ea: feat: export `renderTemplateTree` and `RenderOptions` for use in stack scaffold functions
- 77a06b3: Add non-interactive `make changeset-add` target and update release skill docs

## 0.5.0

### Minor Changes

- c86b0d0: feat: resolve stack version from npm registry at runtime — `registry.json` no longer pins a `stable` version; `dude init` queries npm for `latest`, installs that exact version, and pins it in `dude.json`/`package.json`

## 0.4.0

### Minor Changes

- 3d0a4d1: feat: auto-install stack on demand — when a stack package is not installed locally, dude installs it into `~/.dude/cache/stacks/` using npm and the user's `~/.npmrc` auth; cached by name+version so subsequent runs are instant

## 0.3.0

### Minor Changes

- 7305179: feat: generated project includes pinned package.json + .npmrc — `dude init` now writes a root `package.json` with `@cubocicloide/dude` pinned to the exact version used at init time, and a `.npmrc` ready for GitHub Packages auth

## 0.2.0

### Minor Changes

- b786a3d: feat: add `dude version` command, simplify init to single `dude.json`, add hooks/utils/assets to frontend template, add FE008 lint check, simplify Docker dev setup with HMR volumes
