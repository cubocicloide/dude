---
name: promote-stable
description: Promote a published candidate version (next channel) of a monorepo package to the stable channel (latest)
allowed-tools: 'Bash(git *), Bash(make *), Bash(pnpm *), Bash(npm *)'
---

# Skill: promote-stable

Use this skill when asked to promote a released package version to **stable** —
i.e. move the `latest` dist-tag on GitHub Packages so that `dude init` /
`dude upgrade` start resolving that version by default.

## Background — the two release channels

Every publish (CI via changesets, or `make release`) lands on the **`next`**
dist-tag: the _candidate_ channel. Consumers only get it explicitly
(`dude init --next`, `dude upgrade --next`, `npm i pkg@next`).

The **`latest`** dist-tag is the _stable_ channel — what everything resolves by
default. It only moves when a maintainer runs this promotion flow, after the
candidate has been verified in real use.

Promotion is **per-package** and **independent**: promoting the stack does not
promote the CLI, and vice versa.

---

## Step 0 — Prerequisites

A token with **`write:packages`** scope must be available for `make promote` /
`make dist-tags` — these targets read `GITHUB_TOKEN_ADMIN` from the repo-root
`.env` (gitignored) if present, falling back to `GITHUB_TOKEN` in the shell.
Keeping it in `.env` as `GITHUB_TOKEN_ADMIN` means the everyday `GITHUB_TOKEN`
(often only `read:packages`, per the README setup) doesn't need elevating:

```ini
# .env (repo root, gitignored)
GITHUB_TOKEN_ADMIN=ghp_your_write_packages_token
```

Verify it resolves:

```bash
make dist-tags   # lists channels for every package — fails loudly if no token is found
```

## Step 1 — Identify the candidate

```bash
make dist-tags
```

This lists the channels of every publishable package. The version under `next`
is the promotion candidate; `latest` is what users currently get. If the
package the user named has no `next` tag, ask for an explicit `VERSION=`.

## Step 2 — Verify the candidate before promoting

Never promote a version that has not been exercised. Minimum bar — scaffold
**from the registry** (not from the workspace: inside the repo clone the
workspace scan would shadow the published package) and run the quality gates:

```bash
cd "$(mktemp -d)"
dude init my-check --stack react-fastapi --next --yes
cd my-check && pnpm install
dude lint
dude up && dude test && dude down
```

For the CLI or launcher, the equivalent is installing `@next` globally or via
npx and running the smoke flows. If the user states the version has already
been verified (e.g. it has been in use on their machines), trust that and say
so in your summary.

## Step 3 — Promote

```bash
# Promote whatever `next` currently points to:
make promote PKG=stack-react-fastapi

# Or promote a specific version (e.g. re-promote an older one as a rollback):
make promote PKG=stack-react-fastapi VERSION=12.1.0
```

`PKG` is the short package name (`dude`, `dude-launcher`, `stack-react-fastapi`,
…) or a full scoped name.

## Step 4 — Verify the channels

```bash
make dist-tags
```

`latest` must now point at the promoted version. Report the before/after
versions to the user.

---

## Rollback

Promotion is just a tag move, so rollback is the same operation pointed at the
previous version:

```bash
make promote PKG=stack-react-fastapi VERSION=<previous-stable>
```

## Notes

- A **brand-new package** (first publish ever) has no `latest` tag until its
  first promotion — `dude init` will refuse to resolve it and suggest `--next`.
  Promote its first verified version to make it generally available.
- Promotion never republishes anything: the tarball on the registry is
  immutable; only the dist-tag pointer moves.
- Recording releases is a separate flow — see the `release` skill.
