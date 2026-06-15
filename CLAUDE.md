# CLAUDE.md — dude monorepo

This file gives Claude the context it needs to work effectively in the `dude`
monorepo. Read it fully before making changes.

---

## What this repo is

**dude** is a monorepo that ships two things:

| Package                 | npm name                            | Purpose                                                                               |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/dude/`        | `@cubocicloide/dude`                | The CLI runtime — `dude init`, `dude lint`, `dude up`, …                              |
| `stacks/react-fastapi/` | `@cubocicloide/stack-react-fastapi` | A stack plugin that teaches `dude` how to scaffold and lint a React + FastAPI project |

Everything is TypeScript + ESM. Toolchain: **pnpm workspaces**, **Turbo**, **tsup**.

---

## Repo layout

```
dude/
├── packages/
│   └── dude/                   # CLI runtime
│       ├── src/
│       │   ├── cli.ts           # citty entry point, registers all commands
│       │   ├── commands/        # init, up, down, logs, shell, lint, api, docs, …
│       │   ├── core/            # config, registry, stack-loader, template-runner, …
│       │   └── utils/
│       └── bin/
│           └── dude.mjs         # ESM shim — the installed binary
├── stacks/
│   └── react-fastapi/           # Stack plugin for React + FastAPI
│       ├── src/
│       │   ├── index.ts         # stack entry point (exports stack contract)
│       │   └── commands/
│       │       └── lint/
│       │           └── checks/  # lint rule modules (see below)
│       │               ├── BE/  # backend checks (BE001–BE011)
│       │               ├── FE/  # frontend checks
│       │               └── E2E/ # e2e checks
│       └── templates/           # template overlays
│           ├── base/            # base overlay — always applied
│           ├── postgres/        # overlay — applied when withPostgres = true
│           ├── celery/          # overlay — applied when withCelery = true
│           └── celerybeat/      # overlay — applied when withCeleryBeat = true
├── Makefile                     # top-level developer targets (see below)
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Build

```bash
make install          # install all workspace deps (pnpm install)
make build            # build everything via turbo (tsup for each package)
make cli ARGS="…"     # run the locally-built CLI
```

Single-package builds (faster during iteration):

```bash
pnpm --filter @cubocicloide/dude build
pnpm --filter @cubocicloide/stack-react-fastapi build
```

> Never edit anything under `dist/`. Always rebuild after source changes.

---

## Template system

Each stack ships one or more **template overlays**. `dude init` copies them in
order (base → postgres → celery → celerybeat), with later overlays winning on
conflict.

- Plain files are copied verbatim.
- Files ending in `.hbs` are processed with **Handlebars** and the `.hbs` suffix
  is stripped from the output filename.
- **Boolean context variables** available in every `.hbs` file:
  `withPostgres`, `withCelery`, `withCeleryBeat`, `withRedis`

Overlays live under `stacks/<stack>/templates/` (`base`, `postgres`, `celery`,
`celerybeat`). To add a new file to the base scaffold, drop it in
`stacks/react-fastapi/templates/base/`. To add a file that only appears when
Celery is enabled, drop it in `templates/celery/`.

---

## Lint check architecture

Each lint rule is a TypeScript module in `stacks/react-fastapi/src/commands/lint/checks/{BE,FE,E2E}/NNN.ts`.
Modules are auto-discovered by the build and loaded at runtime — no registration step.

Every lint rule must have a matching prose description in the **generated project's**
`.claude/rules/` directory:
`stacks/react-fastapi/templates/base/.claude/rules/{BE,FE,E2E}/NNN.md`

**Rule**: when you add or change a lint check, update the corresponding
`.claude/rules` file in the template so generated projects stay in sync.

### Adding a new lint check

1. Create `src/commands/lint/checks/BE/NNN.ts` (copy an existing one for structure).
2. Export a default function `check(projectRoot: string): LintResult[]`.
3. Add `templates/base/.claude/rules/BE/NNN.md` describing what the rule enforces and
   how to fix violations.
4. Rebuild the stack: `pnpm --filter @cubocicloide/stack-react-fastapi build`
5. Scaffold + verify: `make dev-init && dude lint` (see dev loop below).

---

## Dev scaffold loop

The standard way to validate template + lint changes:

```bash
# Scaffold a fresh test project (lands in private/examples/test-local/)
make dev-init

# Or with options:
make dev-init STACK_OPTS="--database postgres --celery --celerybeat"

# Run lint checks against the scaffold
cd private/examples/test-local
dude lint
```

`private/` is gitignored — test scaffolds are ephemeral.

---

## Common Makefile targets

| Target            | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `make install`    | `pnpm install` for the whole workspace                   |
| `make build`      | `turbo build` — build every package                      |
| `make dev`        | `turbo dev` — watch mode for all packages                |
| `make test`       | Run all test suites                                      |
| `make lint`       | Lint all TypeScript sources                              |
| `make typecheck`  | `tsc --noEmit` across the workspace                      |
| `make format`     | Prettier the workspace                                   |
| `make cli ARGS=…` | Run the local CLI, e.g. `make cli ARGS="lint"`           |
| `make dev-init`   | Scaffold `private/examples/test-local/` from local stack |
| `make changeset`  | Record a changeset for the next release                  |
| `make release`    | Publish to GitHub Packages                               |
| `make clean`      | Remove `dist/` and `node_modules/`                       |

## Project version pinning

Scaffolded projects record two independent version pins:

- `package.json` → `@cubocicloide/dude`
- `dude.json` → `stack` + `stackVersion`

Use `dude upgrade` inside a generated project to update either or both pins:

```bash
dude upgrade
dude upgrade --cli --cli-version 0.6.1
dude upgrade --stack --stack-version 5.0.5
```

The command does not migrate scaffolded files. Rollback is done by pinning the
previous version again.

---

## Release workflow

```bash
make changeset    # interactively bump versions (patch/minor/major)
# → push; CI opens a "Version Packages" PR
# → merging that PR triggers publish to GitHub Packages automatically
```

---

## Key invariants

- **Every lint check ↔ one `.claude/rules/NNN.md`**: always keep them in sync.
- **Always rebuild after changing source**: `make build` or per-filter build.
- **Always validate with the dev scaffold loop**: change templates/lint → `make dev-init` → `dude lint`.
- **`.hbs` files get Handlebars-processed**: use `{{variable}}` syntax; plain files are copied verbatim.
- **`private/` is gitignored**: never commit test scaffolds.
- **Do not edit `dist/`**: it is overwritten by every build.

---

## Claude guidance for this repo

See `.claude/rules/` for focused rule files.
See `.claude/skills/` for step-by-step skill guides.
