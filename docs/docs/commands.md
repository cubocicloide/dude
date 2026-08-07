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

- `--stack <id>` — which stack to scaffold (see [Stacks](stacks/index.md)).
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

## `dude report`

File a bug report about **dude itself** — the CLI or a stack — against the dude
project, with your `dude info` diagnostics attached automatically. Use it when a
`dude` command misbehaves (not for bugs in your own application code).

```bash
dude report
```

Bare, it opens a pre-filled issue form in your browser — the diagnostics and
your stack are already filled in; you just add the prose. If you have the
[GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated, pass
the details as flags and it files the issue directly:

```bash
dude report \
  --title "dude up crashes the backend on a missing migration" \
  --command "dude up --build" \
  --expected "backend starts and applies migrations" \
  --actual "backend exits 1 with an alembic revision error" \
  --repro "1. dude db rollback
2. dude up --build"
```

| Flag | Meaning |
| ---- | ------- |
| `--title` | Short summary of the problem. |
| `--command` | The dude command you ran, plus its output/error. |
| `--expected` / `--actual` | What you expected vs. what happened. |
| `--repro` | Steps to reproduce (newline-separated). |
| `--context` | Any additional context. |
| `--web` | Force the browser form even if `gh` is available. |
| `--print` | Assemble and print the report; create or open nothing. |

!!! tip "Reporting from your editor"
    In an editor assistant like Claude Code, just say *"report this dude bug"* —
    it can gather the error, run the diagnostics, and drive `dude report` with
    the flags above. The command owns the target repo and the form mapping, so
    the report always lands correctly formatted on the right project.

Issues are filed on `cubocicloide/dude`. Set `DUDE_ISSUES_REPO=<owner>/<repo>`
to target a fork.

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

## `dude mcp`

Serve this project to a coding agent as an [MCP](https://modelcontextprotocol.io)
server over stdio. The tool list is **derived from the resolved catalog** — core
plus the active stack plus project-local `.dude/commands/` — so a stack that adds
a command, or a project that drops one in `.dude/commands/`, needs no wiring here.

```bash
dude mcp                              # read-only tools (the default)
dude mcp --expose "test,api sync"     # opt specific commands in
dude mcp --allow-mutating             # expose everything — see the warning below
```

**Read-only by default.** Only these are exposed without opting in:

| Tool | Backed by |
| ---- | --------- |
| `dude_catalog` | `dude help --format json` — what this project can do, including the commands being withheld |
| `dude_lint` | `dude lint --format json` — structured diagnostics |
| `dude_explain` | `dude explain <CODE>` — the rule behind a diagnostic |
| `dude_cheatsheet` | `dude cheatsheet --format json` |
| `dude_info`, `dude_version` | environment and version reporting |
| `dude_api_review` | when the stack has it |

Everything else — anything that starts containers, writes files, deploys or
destroys — is withheld. The gate is enforced by the server, not by client trust:
a withheld command is never advertised as a tool, and is refused if called anyway.
Arguments that would turn a read-only tool into a writing one are withheld too
(`dude cheatsheet --out <file>` cannot be reached through `dude_cheatsheet`).

Opt in per project via `dude.json`, using the same `"<group> <sub>"` spelling as
`--expose`:

```json
{
  "mcp": {
    "expose": ["test", "api sync"]
  }
}
```

!!! warning "`--allow-mutating`"
    This exposes **every** command in the catalog, including `dude down`,
    `dude iac apply` and `dude iac destroy`. Use it only with a client you
    control, on a project where that is acceptable. Prefer naming the commands
    you actually want in `mcp.expose`.

### Connecting a client

**Claude Code** — from inside the project:

```bash
claude mcp add dude -- dude mcp
```

**Claude Desktop** — add to `claude_desktop_config.json` (absolute path required,
since the server resolves the project from its working directory):

```json
{
  "mcpServers": {
    "dude": {
      "command": "dude",
      "args": ["mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

The server prints its banner to stderr, which clients show as server logs —
stdout carries the protocol and nothing else.

There is no model inside `dude mcp`, no API key and no network call: it runs the
commands this project already has and returns what they already produce.

---

## Beyond core: stack & project commands

- **Stack commands** are declared by the active stack — `up`, `down`, `logs`,
  `shell`, `lint`, `explain`, `format`, `test`, `db`, `security`, `docs`, `iac`,
  and more. They appear in `dude help` only when your stack and init choices
  include them.
- **Project commands** live under `.dude/commands/<name>.ts` in your repo and
  take precedence over stack and core commands of the same name — a project can
  add bespoke tasks without forking anything.

See [How it works → command resolution](concepts.md#command-resolution) for the
precedence rules.

---

## Machine-readable conventions

Every stack ships `lint` and `explain`, and they are designed to be used as a
pair. This is what makes a dude project's conventions *verifiable* rather than
merely documented — the reason the pair exists at all:

```bash
dude lint --format json     # what broke, where, and under which rule code
dude explain BE003          # why that rule exists and how to satisfy it
```

`dude lint --format json` writes nothing but a JSON document to stdout, so it
pipes cleanly:

```bash
dude lint --format json | jq -r '.diagnostics[] | "\(.file):\(.line) \(.code)"'
```

The payload is `{ schema, diagnostics[], errorCount, warningCount, notices[] }`;
`schema` is versioned (`dude.lint/v1`) so a consumer can refuse a shape it does
not understand. Exit codes match the human format — non-zero only when there is
at least one error, so it drops into CI unchanged.

`dude explain <CODE>` prints the rule's own prose: `.claude/rules/<GROUP>/<NNN>.md`
for a stack rule, or the Markdown file beside the check
(`.dude/lint/checks/<GROUP>/<NNN>.md`) for one of your own. Run it with no code
to list every rule that applies to the project you are standing in.
