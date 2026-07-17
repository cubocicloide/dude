# Command reference

This page documents the **core** commands — the stack-agnostic ones the CLI
runtime always provides. Everything else (`up`, `lint`, `test`, `db`, `iac`, …)
comes from the active **stack** and is documented inside each generated project.

!!! info "The authoritative reference is `dude help`"
    Inside any project, `dude help` prints the live, merged catalog: core
    commands + your stack's commands + project-local commands, filtered by your
    init choices. `dude help --format md` emits it as Markdown; `dude docs`
    serves the whole project reference. This page only covers what's common to
    every project.

---

## `dude init`

Scaffold a new project.

```bash
dude init [<dir>] --stack <id> [stack flags] [--yes] [--next]
```

- `--stack <id>` — which stack to scaffold (see [Stacks](stacks.md)).
- `--yes` — accept all defaults; combined with stack-answer flags, fully
  non-interactive.
- `--next` — resolve the stack from the candidate channel instead of stable.
- Stack-answer flags (e.g. `--database postgres`, `--celery`, `--iac …`) vary by
  stack and make init non-interactive for those questions.

---

## `dude upgrade`

Move the CLI and/or stack pins — in both `package.json` and `dude.json`.

```bash
dude upgrade                        # bump both to latest stable
dude upgrade --cli --cli-version 0.13.0
dude upgrade --stack --stack-version 13.0.3
dude upgrade --next                 # target the newest candidate
```

Run `pnpm install` afterwards. `dude upgrade` moves version pins only — it does
not migrate scaffolded files. Roll back by pinning the previous version again.

---

## `dude version`

Print the resolved CLI version, plus the pinned stack version when run inside a
project.

```bash
dude version
```

---

## `dude info`

Print an environment diagnostics report — OS, Node/pnpm/Docker versions, the
resolved CLI + stack versions, and the recorded scaffold answers — as a
copy-pasteable block.

```bash
dude info
```

Run it inside your project and paste the output into a bug report; it gives
triage the environment context up front. It works outside a project too (it just
omits the project-specific lines).

!!! note "Why `info` and not `doctor`?"
    Some stacks ship their own `dude doctor` that verifies a toolchain (the
    tauri stack checks Rust and the mobile SDKs, for example). `dude info` keeps
    a single, consistent bug-report command across every stack without shadowing
    those health checks.

```
dude info

CLI:     @cubocicloide/dude 0.13.0
Stack:   @cubocicloide/stack-react-fastapi@13.0.3
Pinned:  dude 0.13.0 (dude.json)

OS:      Darwin 25.5.0 (arm64)
Node:    v20.17.0
pnpm:    9.6.0
Docker:  Docker version 27.3.1, build ce1223035a
```

---

## `dude help`

Show the merged command catalog, or the flags of a single command / group.

```bash
dude help                    # overview
dude help iac apply          # a specific subcommand's flags
dude help --format md        # emit the whole catalog as Markdown
dude help --format json      # emit it as JSON (for tooling)
```

---

## Beyond core: stack & project commands

- **Stack commands** are declared by the active stack — `up`, `down`, `logs`,
  `shell`, `lint`, `format`, `test`, `db`, `security`, `docs`, `iac`, and more.
  They appear in `dude help` only when your stack and init choices include them.
- **Project commands** live under `.dude/commands/<name>.ts` in your repo and
  take precedence over stack and core commands of the same name — a project can
  add bespoke tasks without forking anything.

See [How it works → command resolution](concepts.md#command-resolution) for the
precedence rules.
