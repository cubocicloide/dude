---
name: convert-electron
description: Convert an existing React and Vite Electron project into the current freshly scaffolded Dude Tauri project. Use when given an Electron project folder and asked to migrate its renderer, preload and main-process behavior, identity, IPC, native integrations, tests, packaging, or persisted data to Tauri 2.
---

# Convert Electron to Tauri

Treat the path supplied with `/convert-electron` as a read-only Electron source.
Perform the conversion in the current Dude Tauri project.

## 1. Establish safety and inventory

1. Confirm the current directory contains `dude.json` for
   `@cubocicloide/stack-tauri`. Stop if it is not a fresh scaffold.
2. Resolve the supplied source path. Reject the current directory, nested
   source/target paths, and missing paths.
3. Record the source's initial `git status --short` when it is a Git checkout.
   Never write, install dependencies, format, or run mutating commands there.
4. Run:

   ```bash
   dude convert electron --source "<electron-project>"
   ```

5. Read `.dude/cache/electron-conversion.json`, the source `package.json`, all
   reported main/preload files, and the renderer entrypoints. Read
   [references/api-map.md](references/api-map.md) for every reported Electron
   API. Treat reported native dependencies as required migration work, not as
   permission to leave Node or Electron in the target. Treat `nodeRuntime`
   dependencies as main-process code that must be translated to Rust or an
   official Tauri plugin; never merge them into frontend dependencies.

## 2. Import the renderer

- Replace the scaffold demo UI with the source React/Vite renderer. For an
  electron-vite project, import `renderer.sourceDir` and its `index.html`; do
  not copy `src/main` or `src/preload` into the frontend.
- Preserve `src-tauri/`, `dude.json`, `.claude/`, `.dude/`, `docs/`, and Dude's
  Tauri commands and rules.
- Adapt the renderer to this stack's `src/pages`, `src/components`, `src/hooks`,
  `src/ipc`, assets, routing, and barrel conventions. Fix structural findings;
  do not disable Dude lint rules to make the import pass.
- Merge application dependencies and useful test scripts into the target
  `package.json`. Keep pnpm and the exact Dude/Tauri pins. Remove Electron,
  electron-vite/builders/forge, Electron-only helpers, main/preload scripts,
  source lockfiles, and packaging configuration.
- Never copy `.git`, `node_modules`, build output, coverage, caches, `.env*`,
  credentials, signing material, or generated installers. Copy `.env.example`
  only when it contains placeholders rather than secrets.

## 3. Preserve identity and behavior

- Make the report's Electron `productName`, `version`, `appId`, and icon the
  Tauri product name, version, identifier, Rust package metadata, and icon set.
  Keep the identifier portable; if the Electron ID is invalid for Tauri,
  normalize only the invalid characters and report the change.
- Recreate window size, minimums, decorations, visibility, routes, menus, tray,
  deep links, single-instance behavior, and lifecycle handling found in the
  main process. Do not invent behavior absent from the source.
- Inspect every use of Electron's `userData` path and persistence packages.
  When the legacy location and format are provable, add an idempotent one-time
  importer that copies data only when the Tauri destination is empty. Preserve
  the original data and test the importer. If the old location or format is
  ambiguous, report the exact ambiguity and do not guess.

## 4. Replace the Electron boundary

- Eliminate the preload and `contextBridge` surface. Create one typed
  `src/ipc/<domain>.ts` wrapper per domain.
- Convert `ipcMain.handle` request/response channels to thin Rust
  `#[tauri::command]` bindings backed by testable plain functions. Register
  them in `commands/mod.rs` and `generate_handler!`.
- Convert one-way and pushed IPC to Tauri events. Subscribe only through
  `useTauriEvent`; own listener cleanup.
- Use official Tauri 2 plugins for system APIs when available. Otherwise write
  a narrowly scoped Rust command. Replace native Node modules with maintained
  Rust crates. Do not retain Electron, enable Node integration, expose a shell
  generically, or add a Node sidecar without explicit user approval.
- Add only the plugin permissions and command scopes actually used by the main
  window. Never grant wildcard filesystem/shell scopes or remote API access.
  Keep CSP changes limited to origins and asset types proven necessary.

## 5. Prove completion

1. Search the target, excluding the cached report, for Electron imports,
   dependencies, main/preload entrypoints, builder/forge configuration,
   `ipcMain`, `ipcRenderer`, and `contextBridge`. Remove every runtime remnant.
2. Install and validate from the target:

   ```bash
   pnpm install
   pnpm build
   dude lint
   dude review
   dude test
   ```

3. Run every migrated renderer test script. Add Rust unit tests for translated
   main-process logic and tests for legacy data import when present.
4. Recheck the source `git status --short`; it must match the initial state.
5. Report migrated domains, plugins/capabilities, identity/data-path decisions,
   commands run, and results. Claim completion only when all required checks
   pass and the target has no Electron runtime dependency. If blocked, name the
   exact source files, APIs, or native packages and the missing safe equivalent.
