# @cubocicloide/dude-launcher

## 0.2.1

### Patch Changes

- be9764c: fix(windows): make dude process execution reliable on win32

  Windows needs `shell: true` for `spawnSync`/`execFileSync` to resolve
  package-manager shims (`.cmd`/`.bat` — pnpm, npm, npx, uv) that aren't real
  executables; without it, spawning them throws `ENOENT` even though the tool
  is on PATH. Every stack command that shells out to a tool other than
  `docker` (a real executable, unaffected) now opts into shell execution on
  `win32` only, and reports `result.error` instead of silently treating a
  failed spawn as a plain non-zero exit. `docs`'s browser launcher now uses
  `cmd /c start` on Windows (bare `start` is a cmd.exe builtin, not a program).

  Covers `dude-launcher` (pnpm/npx install), the CLI core (`dude upgrade`,
  stack resolution/install), and the fastmcp, react-django, react-fastapi,
  tauri and airflow stacks (docs, format, review, test, iac shared exec).

## 0.2.0

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
