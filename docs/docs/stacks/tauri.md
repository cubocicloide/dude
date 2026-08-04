<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/tauri.md -->

# `tauri`

A Tauri 2 desktop app — React + Ant Design frontend, Rust backend, with iOS/Android targets.

**Built with:** `Tauri 2` · `React 19` · `Ant Design` · `Rust`

---

## Scaffold it

```bash
dude init my-app --stack tauri
```

The questions `dude init` asks for this stack — pass the matching flag to
answer it non-interactively. Flag names ignore case and dashes, so
`--celery-beat`, `--celeryBeat` and `--celerybeat` are the same flag.

| Question | Flag | Default |
| -------- | ---- | ------- |
| Project name | `--project-name <value>` | `my-app` |
| Local database | `--database <none\|sqlite>` | `none` |

## What it is for

- A cross-platform desktop app (macOS/Windows/Linux) with a native feel and small binaries
- The same codebase extended to iOS and Android
- A React + Ant Design UI backed by a Rust core for performance-sensitive logic

## Conventions it enforces

`dude lint` runs **23 structural checks** for this stack, grouped by
area. Each one ships a prose rule file in the generated project under
`.claude/rules/`, so both you and a coding agent can see why a check exists
and how to fix a violation.

| Group | Checks |
| ----- | ------ |
| `BE` | 12 |
| `FE` | 11 |

## Documentation inside the project

Every scaffolded project gets its own documentation site, served with
`dude docs`. This stack ships:

| Page | Title | Included |
| ---- | ----- | -------- |
| `index.md` | Home | always |
| `architecture.md` | Architecture | always |
| `mobile.md` | Mobile (iOS/Android) | always |
| `distribute.md` | Distributing | always |
| `dude.md` | Working with dude | always |
| `api.md` | Command reference | always |
| `mkdocs.md` | Writing docs | always |

## Versions

- **Package:** [`@cubocicloide/stack-tauri`](https://www.npmjs.com/package/@cubocicloide/stack-tauri)
- **Requires dude:** `>= 0.1.0`

Both the CLI and the stack are pinned per project, so different projects can
sit on different versions. See [How it works](../concepts.md).
