---
name: create
description: Guided scaffolding for this stack. Asks whether you want to create a backend route or a frontend page, then runs the matching convention-aware flow (create-route or create-page) that inspects existing code and enforces the stack's BE/FE rules.
disable-model-invocation: false
allowed-tools: "Read Glob Grep Bash(find *) Bash(cat *)"
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
> 1. **Route** — a backend API endpoint (DRF view/serializer/service + urls + migration + tests)
> 2. **Page** — a frontend screen (React page + route wiring + components/hooks)

Map free-form answers too: "endpoint", "API", "router" → route; "screen",
"view", "UI", "component-heavy view" → page.

## Step 2 — Hand off

- **Route** → read `.claude/skills/create-route/SKILL.md` and follow it from Step 0.
- **Page**  → read `.claude/skills/create-page/SKILL.md` and follow it from Step 0.

Pass along anything the user already specified (path, method, what to display)
so the worker skill can skip questions it already has answers for.

## Notes

- This router never writes files itself — it only routes.
- Both worker skills are also invocable directly (`/create-route`, `/create-page`)
  when you already know which one you need.
