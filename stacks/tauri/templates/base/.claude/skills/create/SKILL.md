---
name: create
description: Guided scaffolding for this stack. Asks whether you want to create a Tauri command domain (Rust + IPC) or a frontend page, then runs the matching convention-aware flow (create-command or create-page) that inspects existing code and enforces the stack's BE/FE rules. Also routes plugin wiring and mobile releases to their own skills.
disable-model-invocation: false
allowed-tools: "Read Glob Grep Bash(find *) Bash(cat *) Bash(ls *)"
---

# Create (router)

Single entry point for scaffolding new code in this project. It figures out
**what** you want to build, then hands off to the specialised skill that knows
the exact conventions (see `.claude/rules/`) and inspects the existing codebase
before writing anything.

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report _"No dude.json found — are you inside a dude project?"_ and stop.
Set `PROJECT_ROOT` to the directory containing `dude.json`.

## Step 1 — Ask what to create

If the user has not already made it explicit, ask:

> **What do you want to create?**
> 1. **Command** — a Tauri command domain (Rust module under `src-tauri/src/commands/`
>    + `generate_handler!` registration + typed `src/ipc/` wrapper + unit tests)
> 2. **Page** — a frontend screen (React + antd page, routed in `App.tsx`,
>    menu entry in `Layout`)

Map free-form answers too: "backend", "Rust", "IPC", "invoke", "expose … to the
frontend" → command; "screen", "view", "UI", "route" → page.

A feature that needs both is normal — the two are ordered: build the command
first so the page has a typed `@/ipc` call to bind to. Say so and run
`/create-command`, then `/create-page`.

## Step 2 — Hand off

- **Command** → read `.claude/skills/create-command/SKILL.md` and follow it from step 1.
- **Page** → read `.claude/skills/create-page/SKILL.md` and follow it from step 1.

Pass along anything the user already specified (domain name, route path, what to
display, which commands the page needs) so the worker skill can skip questions it
already has answers for.

## Step 3 — Not a "create" task?

Two neighbouring flows have their own skills — route to them instead of
improvising:

| The user wants | Skill |
| -------------- | ----- |
| To add a Tauri plugin (`fs`, `dialog`, `store`, `shell`, `notification`, …), or is hitting a *"not allowed"* permission error at runtime | `/add-plugin` — Cargo crate + `.plugin(…)` in `lib.rs` + JS package + the exact capability permission (BE010) |
| To ship to Android or iOS, or to set the project up for mobile the first time | `/release-mobile` — `dude doctor` preflight, `dude android\|ios init`, versioning, signing, `dude android\|ios build` |

## Notes

- This router never writes files itself — it only routes.
- Every worker skill is also invocable directly (`/create-command`,
  `/create-page`, `/add-plugin`, `/release-mobile`) when you already know which
  one you need.
- Whichever path is taken, the change is done only when
  `dude lint && dude test && dude review` are green. Use
  `dude lint --format json` to read the diagnostics structurally and
  `dude explain <CODE>` for the prose behind any code they report.
