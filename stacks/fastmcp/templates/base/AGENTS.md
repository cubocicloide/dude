# AGENTS.md

Entry point for coding agents. This file is deliberately a **pointer**, not a
second copy of the project guidance — duplicated instructions drift.

## 1. Ask the project what it is

```bash
dude cheatsheet --format json
```

One call returns this project's live command catalog, every lint rule with its
code and title, the verify loop, and the answers it was scaffolded with. It is
generated from the project itself, so it is always current. Prefer it over any
hand-written command list.

`dude help --format json` returns just the command catalog, if that is all you
need.

## 2. Read the conventions before writing code

- **[CLAUDE.md](CLAUDE.md)** — the full project guidance: layout, stack
  conventions, workflows, and what not to do. Written for Claude Code, but it is
  plain Markdown and applies to any agent.
- **`.claude/rules/<GROUP>/<NNN>.md`** — one file per lint rule, explaining why
  it exists and how to fix a violation. When `dude lint` reports `BE003`, read
  `.claude/rules/BE/003.md`.

## 3. Verify your own work

Do not report a change as done until these pass:

```bash
dude lint     # structural conventions — the project's actual contract
dude test     # the test suites
```

`dude lint` is the point: this project's conventions are enforced mechanically,
so you can check your output instead of guessing. If a diagnostic is in your way,
read its rule file and fix the cause — do not work around the check.
