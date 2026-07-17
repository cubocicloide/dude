# Troubleshooting

Common issues and how to get unstuck — plus how to file a bug report that gets
fixed fast.

---

## Start here: `dude info`

Whenever something is off, run:

```bash
dude info
```

It reports your OS, Node/pnpm/Docker versions, the resolved CLI + stack
versions, and your scaffold answers. Most environment problems are visible right
in that output (wrong Node version, Docker not installed, a stale pin).

---

## Common issues

### `401 Unauthorized` when installing

Your registry auth isn't set up. Confirm `~/.npmrc` has the `@cubocicloide`
scope and that `GITHUB_TOKEN` is exported with the `read:packages` scope. See
[Getting started → authenticate the registry](getting-started.md#1-authenticate-the-registry-one-time-per-machine).

### "Stack entry point not found" / `dist/index.js` missing

You're running against a **source checkout** of a stack that hasn't been built.
This only happens when working inside the `dude` monorepo itself, not in a
generated project. Build the workspace (`make build`) and retry.

### `dude up` fails immediately

Docker isn't running. Start Docker Desktop and try again — `dude info` will
show `Docker: not found` if the CLI can't reach it.

### A command I expected isn't listed

`dude help` reflects your **init choices**. Database commands need a database,
the IaC group needs IaC enabled at init, and so on. If you need a capability you
didn't select, re-scaffold with the right flags or add it manually.

### "requires dude >= X, but the running CLI is Y"

Your pinned CLI is older than the stack requires. Bump it:

```bash
dude upgrade --cli
pnpm install
```

### A brand-new stack won't scaffold on stable

A stack has no `latest` (stable) dist-tag until its first promotion. Scaffold it
from the candidate channel:

```bash
dude init my-app --stack <new-stack> --next
```

---

## Filing a bug report

Bugs are tracked as GitHub issues on
[cubocicloide/dude](https://github.com/cubocicloide/dude/issues). Opening a new
issue presents a structured form — please use it rather than a blank issue.

A good report includes:

1. **`dude info` output** — paste the whole block. This is the single most
   useful thing you can provide.
2. **The exact command** you ran and its full output (redact secrets).
3. **What you expected** vs. **what happened**.
4. **Minimal steps to reproduce** from a fresh scaffold, if you can.

For "how do I…?" questions rather than bugs, use
[GitHub Discussions](https://github.com/cubocicloide/dude/discussions) instead —
it keeps the issue tracker focused on actionable defects.
