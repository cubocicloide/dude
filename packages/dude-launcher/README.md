# @cubocicloide/dude-launcher

A tiny global shim for [`dude`](https://github.com/cubocicloide/dude). Install it
once, globally; it makes `dude <cmd>` always run **the version each project
pins** — no manual version switching across projects.

## Why

A scaffolded dude project pins two things in `package.json` (lockfile-enforced):

- `@cubocicloide/dude` — the CLI runtime
- `@cubocicloide/stack-<name>` — the stack plugin

Different projects pin different versions. The launcher reads the project it is
invoked in and runs that project's exact toolchain, so collaborators and CI all
get identical behaviour from a single `dude` command.

## Install

```bash
npm install -g @cubocicloide/dude-launcher
```

(Published on the public npm registry — no auth or token required to install.)

## How it works

Running `dude <args>`:

1. Walks up from the current directory to the nearest `dude.json`.
2. **Inside a project**: if the pinned `@cubocicloide/dude` / stack versions are
   not installed (or an exact pin disagrees with what's in `node_modules`), it
   runs the project's package manager (`pnpm`/`yarn`/`npm`) to provision them,
   then re-execs `node_modules/.bin/dude`.
3. **Outside a project**: project-less commands (`init`, `version`, `help`) are
   delegated to the latest published CLI via `npx`. Anything else prints a clear
   "no dude.json found" error.

## Environment variables

| Variable               | Effect                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| `DUDE_SKIP_PROVISION`  | Skip the install check and run whatever is already in node_modules |

## Relationship to the CLI

This package contains **no** dude logic — only resolution and delegation. It
changes rarely. All commands, scaffolding, and lint rules live in the per-project
`@cubocicloide/dude` CLI and its stacks.
