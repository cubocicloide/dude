---
name: create
description: Guided scaffolding for this stack. Asks whether you want to create a new MCP feature sub-server or add a tool/resource/prompt to an existing one, then runs the matching convention-aware flow (create-feature or create-tool) that inspects existing code and enforces the stack's MCP rules.
disable-model-invocation: false
allowed-tools: "Read Glob Grep Bash(find *) Bash(cat *) Bash(ls *)"
---

# Create (router)

Single entry point for scaffolding new code in this project. It figures out
**what** you want to build, then hands off to the specialised skill that knows
the exact conventions (see `.claude/rules/MCP/`) and inspects the existing
codebase before writing anything.

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report _"No dude.json found — are you inside a dude project?"_ and stop.
Set `PROJECT_ROOT` to the directory containing `dude.json`.

## Step 1 — Ask what to create

If the user has not already made it explicit, ask:

> **What do you want to create?**
> 1. **Feature** — a new MCP sub-server (`features/<name>/` with its own server, components, service and tests)
> 2. **Tool** — a tool, resource or prompt inside a feature that already exists

Map free-form answers too: "sub-server", "module", "bounded context", "domain"
→ feature; "endpoint", "action", "function the model can call", "resource",
"prompt" → tool.

When the answer is ambiguous, list what exists and let it decide the split:

```bash
ls "$PROJECT_ROOT"/fastmcp/app/features
```

If the thing being added belongs to one of those bounded contexts, it is a
**tool**; if it is a new context, it is a **feature**.

## Step 2 — Hand off

- **Feature** → read `.claude/skills/create-feature/SKILL.md` and follow it from Step 0.
- **Tool**    → read `.claude/skills/create-tool/SKILL.md` and follow it from Step 0.

Pass along anything the user already specified (feature name, tool name,
parameters, return shape) so the worker skill can skip questions it already has
answers for.

## Notes

- This router never writes files itself — it only routes.
- Both worker skills are also invocable directly (`/create-feature`, `/create-tool`)
  when you already know which one you need.
- `create-tool` covers resources and prompts as well — they are the same flow with
  a different decorator and package.
