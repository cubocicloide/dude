# @cubocicloide/stack-tauri

## 2.2.0

### Minor Changes

- eb5312e: Bring the agent-facing surface to parity across all six stacks.

  `airflow` and `fastmcp` shipped no skills at all; `tauri` and `frappe` shipped a
  partial set, and three stacks had no `.vscode/tasks.json` and no `issue-fixer`
  agent. Every stack now ships the same minimum: the lint-watch editor task, an
  `issue-fixer` agent, the stack-agnostic workflow skills, and `create-*` skills
  for its own primary artifacts — each one written against that stack's real
  commands and lint rules, and ending in a `dude lint --format json` /
  `dude explain <CODE>` verification step.

  New per stack:

  - **airflow** — `create-dag`, `create-connection`, a `create` router, tasks.json, issue-fixer.
  - **fastmcp** — `create-feature`, `create-tool`, a `create` router, tasks.json, issue-fixer, security-fixer, and the security/Jira skill set it was missing despite registering `dude security`.
  - **tauri** — `add-plugin`, `release-mobile`, a `create` router, tasks.json, issue-fixer.
  - **frappe** — `create-hook`, `create-api-method`, a `create` router, issue-fixer.

  Also fixed, found while doing this:

  - `frappe`'s `docs/extending.md` attributed `doc_events` to APP002 and fixtures to APP003; the real codes are APP003 and APP004.
  - The shared `fix-issues` skill told the agent to fall back to `cd backend && python -m pytest` / `cd frontend && pnpm test`, paths that exist on two stacks out of six. It now uses `dude test`, which all six register.
  - Stacks shipping Jira-driven skills lacked the `mcp__atlassian__*` permissions in `.claude/settings.json`, so those skills would prompt on every call.

- eb5312e: Add `dude lint --format json` and `dude explain <CODE>`.

  `dude lint --format json` emits the diagnostics that were always structured
  internally and only ever printed as prose:
  `{ schema, diagnostics, errorCount, warningCount, notices }`, and nothing else on
  stdout, so it pipes. Exit codes are unchanged, and `--quiet` composes (it filters
  the listing; the counts stay the true totals, as in the human format).

  `dude explain <CODE>` prints the prose behind a rule — `.claude/rules/<GROUP>/<NNN>.md`
  for a stack rule, or the sibling `.dude/lint/checks/<GROUP>/<NNN>.md` for a project
  rule, the convention the scaffolded contract already advertised but nothing read.
  With no code it lists every rule that applies to the current project.

  Also in this change:

  - Stack commands can declare `type: 'positional'` arguments, and the dispatcher
    binds them. Bare words were previously parsed and dropped, so a positional
    could never reach a command's `run`.
  - `dude cheatsheet` now resolves project-rule titles through the same lookup as
    `explain`, instead of degrading every project rule to a bare code.
  - Every stack template ships `.dude/lint/checks/PRJ/001.md` beside its example
    check, so the documented pairing has a worked example.

### Patch Changes

- Updated dependencies [eb5312e]
- Updated dependencies [eb5312e]
  - @cubocicloide/dude@0.17.0

## 2.1.0

### Minor Changes

- 76931e9: Add `dude cheatsheet` — one dense, answer-aware reference for the project you are
  standing in: how it was scaffolded, the verify loop (only steps this project
  actually has), every lint rule with its one-line title, the top-level layout, and
  the full command catalog. Everything is derived from the live catalog and the
  project's own `.claude/rules/` files, so it stays correct as init answers, stack
  versions and project-local commands change.

  `--format json` emits the same data with a `dude.cheatsheet/1` schema marker and
  the command catalog embedded, so a coding agent gets what it may run and what will
  be checked in a single fetch instead of crawling a documentation site.

  The renderer lives in the CLI (`generateCheatsheet`) and every stack registers the
  shared command with `defineCheatsheetCommand()`, mirroring `defineLintCommand()` —
  never hand-roll a per-stack cheatsheet.

- 22fb522: Add an optional `docs` manifest to the stack contract (`StackDefinition.docs`), validated with a new `stackDocsSchema` (exported alongside `StackDocs`) that follows the existing `stackVariableSchema` pattern — plain, serializable data, so it stays safe to pass to future tooling. `loadStack` now validates a declared manifest at load time and throws a descriptive error if it is malformed, so a bad manifest fails loudly instead of silently degrading downstream.

  All six stacks (`react-fastapi`, `react-django`, `fastmcp`, `tauri`, `frappe`, `airflow`) now populate the manifest: a one-line tagline, "if you're building…" use cases, headline technologies, the IaC target (when the stack has one), and the exact page set the stack's scaffold ships under `docs/docs/` (including the conditional `deploy.md` from the IaC overlay). No user-visible output changes in this slice — the manifest is typed data for the root-site composer and other documentation tooling to consume in a following change (see issue #113).

- 76931e9: Give coding agents a real entry point in every scaffolded project.

  - **`AGENTS.md`** — a thin pointer for non-Claude agents: ask the project what it
    is with `dude cheatsheet --format json`, read the conventions in `CLAUDE.md` and
    `.claude/rules/`, then verify with `dude lint` and `dude test`. Deliberately a
    pointer rather than a second copy of the guidance, because duplicated
    instructions drift.
  - **`CLAUDE.md`** now opens with the cheatsheet: one call returns the project's
    live command catalog, every lint rule, the verify loop and the init answers, so
    an agent should prefer it over any hand-written command list in the file.

  Both lean on the same idea: this project's conventions are enforced mechanically,
  so an agent can check its own output rather than guess.

- 76931e9: Move the `docs` command into the CLI as `defineDocsCommand()`, which every stack
  now registers — the same pattern as `defineLintCommand()`. The six stacks were
  carrying byte-identical 117-line copies, so adding a generated page meant editing
  six places; it is one place now.

  The shared command refreshes every generated page the scaffold ships before
  serving: `api.md` from the live command catalog, and `cheatsheet.md` from the
  project's rules and answers. Each refresh is independent and best-effort, so a
  failure leaves the committed placeholder and never blocks serving.

  Each stack's project documentation site now includes a **Cheatsheet** page,
  regenerated on every `dude docs` and pointing coding agents at
  `dude cheatsheet --format json`.

### Patch Changes

- 76931e9: Fix two correctness bugs found reviewing the docs-composition work.

  **A stack newer than the running CLI now fails legibly.** A stack's module body
  calls the CLI's `define*Command()` helpers while building its `commands` map, so it
  throws while being _imported_ — before `minDudeVersion` can be read, and for every
  command rather than only the one needing the new API. Previously that surfaced as a
  raw Node stack trace. `cli.ts` now catches the load failure and explains it, and
  core commands (`version`, `upgrade`, `info`) fall through and keep working, since
  `dude upgrade --cli` is the way out of exactly this situation.

  **`dude cheatsheet` no longer reports disabled rules as enforced.** It read
  `.claude/rules/` directly and ignored `dude.json` → `lint.disable`, which the lint
  engine honours — so a project that switched a code off still saw it listed under
  "rules `dude lint` runs". Disabled codes are now excluded and stated in their own
  section, project-local checks under `.dude/lint/checks/` are included (they run but
  ship no prose file), and each rule says which source it came from.

  Also: the core command registry is now defined once (`coreCommands`) and drives
  citty's dispatch, the published catalog and the tests, instead of two
  hand-maintained lists that had already drifted; `catalogToMarkdown` takes a
  `standalone` option instead of being string-spliced by its caller; a malformed
  `dude.json` produces a warning instead of a silently truncated page; and the
  catalog is resolved once per render rather than two or three times.

- 76931e9: Fix four defects found reviewing the previous round of fixes.

  **`dude init` no longer dumps a stack trace when the stack is newer than the CLI.**
  The earlier guard only covered commands run inside an existing project; `init`
  resolves the stack itself, and that is the path every _new_ project takes. Since
  promotion to `latest` is per-package, a stack promoted before the CLI reproduced
  this for real users. The version-skew advice is also now offered **conditionally** —
  appending it to every failure told people to run `dude upgrade --cli` right after
  the loader had correctly told them to build the stack.

  **A malformed `dude.json` is explained instead of crashing.** The dispatcher parsed
  it unguarded, so _every_ command in such a project died with a raw `SyntaxError`,
  including the ones needed to fix it. `readDisabledCodes` had the same hole.

  **`dude cheatsheet` now derives the enforced rule set from the lint engine itself**
  (`discoverCheckCodes`), not from the project's `.claude/rules/` prose directory.
  Those are two independently-mutable trees, so the page could omit a rule that runs
  (stale prose after `dude upgrade --stack`) or invent one that does not (leftover
  prose), and its own copy of the loadable-extension list had already lost `.mts`.
  Rule files now supply only titles. A stack/project code collision — which makes
  `runLint` refuse to run at all — is reported instead of silently resolved.

  **The composer validates its own tables.** Escaping there had been wrong three
  times; the check now fails the build on a row whose cell count does not match its
  header, or on a value escaped twice.

- Updated dependencies [76931e9]
- Updated dependencies [22fb522]
- Updated dependencies [76931e9]
- Updated dependencies [76931e9]
- Updated dependencies [76931e9]
- Updated dependencies [76931e9]
  - @cubocicloide/dude@0.16.0

## 2.0.5

### Patch Changes

- Updated dependencies [36aace0]
  - @cubocicloide/dude@0.15.1

## 2.0.4

### Patch Changes

- Updated dependencies [e38638f]
  - @cubocicloide/dude@0.15.0

## 2.0.3

### Patch Changes

- Updated dependencies [f8bfe29]
  - @cubocicloide/dude@0.14.0

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
