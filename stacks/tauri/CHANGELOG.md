# @cubocicloide/stack-tauri

## 2.0.2

### Patch Changes

- 59902ae: Fix `dude init` failing with `Cannot find package '@cubocicloide/dude'` when a stack is resolved via the cache-install path (fresh machine, no existing workspace/project). `@cubocicloide/dude` is imported unbundled at runtime (`external` in tsup) but had only been declared in `devDependencies` since #78 removed the redundant `peerDependencies` entry — devDependencies are never installed for a package consumed as someone else's dependency, so nothing pulled `@cubocicloide/dude` into `~/.dude/cache/stacks/…/node_modules`. Moved it to a real `dependencies` entry (still `workspace:*`, rewritten to an exact version at publish) instead of `peerDependencies`, so it installs correctly without reintroducing the changesets peer-range major-bump bug.

## 2.0.1

### Patch Changes

- c93f206: Drop the redundant `peerDependencies` on `@cubocicloide/dude` from every stack. It duplicated the `devDependencies` pin and served no functional purpose (scaffolded projects pin `dude` directly; runtime compatibility is enforced by `minDudeVersion`). The `workspace:^` form also triggered a Changesets bug that forced a spurious **major** bump on every stack whenever `dude` was released; with the peer entry gone, a `dude` release no longer re-versions the stacks at all.

## 2.0.0

### Patch Changes

- Updated dependencies [628eb2b]
  - @cubocicloide/dude@0.13.0

## 1.0.0

### Minor Changes

- 397fef5: Project-defined lint rules, uniform across every stack.
  - `dude lint` now also runs project checks from `.dude/lint/checks/<GROUP>/<id>.ts`
    (loaded via jiti — real TypeScript, project imports allowed), under the same
    `CheckFn` contract stack checks use; the rule code is derived from the path.
  - A code defined twice (stack + project, or twice in the project) is a hard
    error; stack rules can be disabled per-project via `dude.json` →
    `lint.disable: ["BE003", …]` (unknown codes produce a notice).
  - New `defineLintCommand()` export in `@cubocicloide/dude`; all stacks now
    register their `lint` command through it instead of hand-rolled wrappers
    (the stacks' peer range on `@cubocicloide/dude` moves to `^0.12.0`
    accordingly — upgrade both pins together with `dude upgrade`).
  - Scaffolds ship a `.dude/lint/checks/` README + `PRJ/001.ts` starter example,
    and the generated docs describe project lint rules.

### Patch Changes

- Updated dependencies [397fef5]
  - @cubocicloide/dude@0.12.0

## 0.3.1

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

- Updated dependencies [be9764c]
  - @cubocicloide/dude@0.11.6

## 0.3.0

### Minor Changes

- 2832af6: Add mobile (iOS/Android) support to the `tauri` stack — same codebase as
  desktop. New command groups `dude android init|dev|build` and
  `dude ios init|dev|build` (iOS gated to macOS): `init` installs the Rust
  cross-compilation targets and generates the native project
  (`src-tauri/gen/android` / `gen/apple`), refreshing the app icons into it;
  `dev` supports `--open` (IDE) and `--host` (physical devices); `build`
  exposes `--apk`/`--aab`/`--target` (Android) and `--export-method` (iOS).

  `dude doctor` now reports optional mobile prerequisites (Android SDK/NDK/Java/
  Rust targets, and on macOS Xcode/CocoaPods/iOS Rust targets). The bundle
  identifier is sanitized at scaffold time to stay mobile-portable
  (`com.<alnum>.app` — Android forbids dashes, Apple forbids underscores); a new
  lint check BE012 keeps the `mobile_entry_point` attribute on `lib.rs`, and
  BE009 now warns on non-portable identifiers.

  Generated docs gain a Mobile page (prerequisites, init/dev/build, signing) and
  a Distributing page explaining why an ad-hoc-signed desktop build shows
  "damaged" on another Mac and how to configure Developer ID signing +
  notarization (macOS) / SmartScreen signing (Windows) for real distribution.

## 0.2.0

### Minor Changes

- 2ccc3a6: Add the `tauri` stack: scaffolds a Tauri 2 desktop app (React 19 + Vite +
  Ant Design frontend, Rust backend) with an optional SQLite database
  (`--database sqlite`). Ships `dev`, `build`, `doctor`, `icon`, `lint`,
  `format`, `review`, `test` and `docs` commands, plus 22 structural lint
  checks (FE001–FE011 for the React side, BE001–BE011 for Rust/Tauri best
  practices) each documented in the generated project's `.claude/rules/`.
  The CLI registry now resolves the `tauri` stack name.

### Patch Changes

- Updated dependencies [2ccc3a6]
  - @cubocicloide/dude@0.11.3
