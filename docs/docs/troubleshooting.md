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

### `404 Not Found` for a `@cubocicloide/*` package when installing

`dude` is published on the public npm registry and needs no auth to install. A
404 usually means either a typo in the package name, or a project `.npmrc` that
points the `@cubocicloide` scope at a different registry — remove any
`@cubocicloide:registry=…` line so it resolves from the default public registry.

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

The easiest way is to let dude do it for you:

```bash
dude report
```

This attaches your `dude info` diagnostics and opens a pre-filled issue form (or
files it directly via `gh` if you're authenticated). See
[`dude report`](commands.md#dude-report) for the flags. In an editor assistant
like Claude Code, you can just say *"report this dude bug"* and let it drive the
command.

If you'd rather open the issue by hand, bugs are tracked on
[cubocicloide/dude](https://github.com/cubocicloide/dude/issues) — the new-issue
form is structured; please use it rather than a blank issue. A good report
includes:

1. **`dude info` output** — paste the whole block. This is the single most
   useful thing you can provide.
2. **The exact command** you ran and its full output (redact secrets).
3. **What you expected** vs. **what happened**.
4. **Minimal steps to reproduce** from a fresh scaffold, if you can.

For "how do I…?" questions rather than bugs, use
[GitHub Discussions](https://github.com/cubocicloide/dude/discussions) instead —
it keeps the issue tracker focused on actionable defects.

---

## What happens after you report

Knowing the journey helps set expectations:

1. **Triage.** A maintainer reviews the issue, confirms it's reproducible, and
   labels it — by stack (`stack:react-fastapi`, …) and, if the report is missing
   information, `needs-repro`. If it duplicates an existing issue, you'll get a
   link to the original. Triage is AI-assisted but **always confirmed by a
   human** — nothing valid is closed automatically.
2. **Fix.** When an issue is ready, a maintainer implements it and opens a pull
   request. AI tooling may draft the fix, but every change is **reviewed by a
   person** before it merges — nothing is auto-merged.
3. **Release.** Once merged, the fix publishes to the **candidate** channel
   (`next`) and, after verification, is promoted to **stable** (`latest`). Pull
   it into your project with `dude upgrade` (add `--next` to try the candidate
   early). See [How it works → release channels](concepts.md#release-channels).

!!! note "Housekeeping"
    Issues with no activity for a couple of months are marked stale and
    eventually closed to keep the tracker honest — a comment reopens the
    conversation any time. Contributors and maintainers run this triage and fix
    tooling locally with their own Claude accounts; if you'd like to help, see
    [CONTRIBUTING](https://github.com/cubocicloide/dude/blob/master/CONTRIBUTING.md).
