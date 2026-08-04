# @cubocicloide/stack-fastmcp

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

## 0.3.2

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

## 0.3.1

### Patch Changes

- 846c277: Fix `dude iac apply` failing with `InvalidParameterValue: ... Character sets
beyond ASCII are not supported` for the `aws-ecs` IaC target. The `alb` and
  `service` security group descriptions used an em-dash, which AWS's
  `CreateSecurityGroup` API rejects; replaced with a plain hyphen.

## 0.3.0

### Minor Changes

- 98e5de4: Add AWS deployment support to the fastmcp stack (`--iac aws-ecs`): the init flow
  now asks for an IaC target (none / aws-ecs). Choosing `aws-ecs` scaffolds
  Terraform for a single ECS Fargate service behind an ALB (SSE-friendly idle
  timeout, `/health` target-group probe, optional ACM + Route53 HTTPS), a shared
  bootstrap (S3 state + DynamoDB lock + ECR repository), a production Dockerfile,
  an IaC runner image and a deploy docs page — plus the full `dude iac` command
  group (login, new-env, bootstrap, init, plan, apply, build, push, deploy, ship,
  status, logs, output, fmt, validate, shell, destroy). The base template gains a
  plain-HTTP `/health` route on the server for load-balancer health checks.

## 0.2.0

### Minor Changes

- 2537e53: feat(fastmcp): introduce the `fastmcp` stack plugin

  Adds `@cubocicloide/stack-fastmcp` — a new official `dude` stack for Python
  MCP servers built with [FastMCP 3.4+](https://github.com/jlowin/fastmcp).

  **What's in the stack**
  - Scaffold command (`dude init --stack fastmcp`) that generates a modular
    FastMCP monolith: main server in `fastmcp/app/`, feature sub-servers mounted
    via `fastmcp.mount()`, Pydantic schemas, shared utilities, and a full pytest
    suite.
  - Docker Compose setup: `fastmcp` service (HTTP transport) + optional
    MCP Inspector UI behind the `dev` Docker Compose profile.
  - Commands: `up`, `down`, `logs`, `shell`, `lint`, `format`, `review`, `test`,
    `docs`, `security`.
  - 17 deterministic lint rules (MCP001–MCP017) covering: required project
    structure, feature package shape, sub-server contract, component placement,
    one-component-per-module, docstrings, type annotations, thin binding layer,
    Context convention, resource URI↔param parity, Pydantic schema conventions,
    snake_case naming, name/URI uniqueness, environment access isolation, no
    `print()` in production, error handling (ToolError only), and 1-to-1 test
    parity.
  - Matching `.claude/rules/MCP/NNN.md` prose files in the generated project so
    Claude Code understands every rule and can guide developers to fix violations.
  - MkDocs Material docs site with a `connect.md` page covering Inspector,
    Claude Desktop (stdio), and Claude Code integration.

  **Core fix (dude CLI)**

  `template-runner.ts`: the `_x` → `.x` dotfile rename rule now skips any file
  whose target name ends in `.py`, so Python private modules like `_server.py`
  survive scaffolding intact. Dotfiles never end in `.py`, so this is safe for
  all existing stacks.

### Patch Changes

- Updated dependencies [2537e53]
  - @cubocicloide/dude@0.11.1
