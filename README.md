# dude

> Cubocicloide's internal project scaffolding & code quality CLI.
> Multi-stack, plugin-based, distributed via GitHub Packages.

`dude` is a private command-line tool that bootstraps new projects, enforces
linting and conventions, generates code, and assists with code review across
all stacks Cubocicloide works with.

The CLI itself is **stack-agnostic**: every supported stack (React+FastAPI,
React+Django, …) lives in a dedicated plugin package that ships its own
templates, lint configuration, rules, generators and lifecycle hooks. Adding
or evolving a stack does not require a new CLI release.

For the full design rationale see [`ANALYSIS.md`](./ANALYSIS.md).

---

## Repository layout

This repository is a **pnpm + turbo + changesets monorepo** that hosts the
CLI runtime and the official stack plugins.

```
dude/
├── packages/
│   └── dude/                       # @cubocicloide/dude — CLI runtime
└── stacks/
    └── react-fastapi/              # @cubocicloide/stack-react-fastapi
```

Third-party or experimental stack plugins live in separate repositories and
plug into the CLI via the same contract.

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`corepack enable` is the recommended way to install it)
- **Make** (preinstalled on macOS / Linux)
- A GitHub Personal Access Token with `read:packages` scope, exported as
  `GITHUB_TOKEN`, to install/publish packages on GitHub Packages.

---

## Getting started (contributor)

```bash
# 1. Clone
git clone git@github.com:cubocicloide/dude.git
cd dude

# 2. Authenticate to GitHub Packages
export GITHUB_TOKEN=ghp_xxx

# 3. Install dependencies and build all packages
make install
make build

# 4. Run the CLI locally
make cli ARGS="--help"
make cli ARGS="init --stack react-fastapi"
```

The CLI invoked through `make cli` runs from sources via `pnpm` workspaces,
so changes in `packages/dude` or `stacks/*` are picked up immediately.

---

## Common tasks

All day-to-day operations are wrapped in the [Makefile](./Makefile). Run
`make help` for a self-documenting list.

| Command           | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `make install`    | Install all workspace dependencies                        |
| `make build`      | Build every package via turbo                             |
| `make test`       | Run all tests                                             |
| `make lint`       | Lint every package                                        |
| `make typecheck`  | TypeScript type-check across the workspace                |
| `make format`     | Format the entire workspace with Prettier                 |
| `make dev`        | Run all package dev scripts in parallel                   |
| `make cli ARGS=…` | Run the local CLI (e.g. `make cli ARGS="init --stack X"`) |
| `make changeset`  | Record a changeset for the next release                   |
| `make release`    | Publish updated packages to GitHub Packages               |
| `make clean`      | Remove build artifacts and `node_modules`                 |

---

## End-user setup (consuming `dude` in another project)

Once published on GitHub Packages, install the CLI with:

```bash
# In ~/.npmrc or in the project's .npmrc
@cubocicloide:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

# Then
export GITHUB_TOKEN=ghp_xxx
npm i -g @cubocicloide/dude

dude init --stack react-fastapi
```

The CLI will fetch the requested stack plugin from the private registry on
demand and cache it locally under `~/.dude/stacks/`.

---

## Releasing

We use [changesets](https://github.com/changesets/changesets) for
independently versioning the CLI and each stack package.

```bash
# After making changes
make changeset          # interactively select packages + bump type

# On merge to main, CI opens a "Version Packages" PR.
# Merging that PR triggers the actual publish to GitHub Packages.
```

---

## Project status

🚧 **Early bootstrap.** The current iteration ships:

- The monorepo skeleton (workspaces, turbo, changesets)
- A minimal `@cubocicloide/dude` CLI runtime with `defineStack` /
  `defineConfig` helpers and an `init` command that scaffolds from a local
  stack plugin
- A minimal `@cubocicloide/stack-react-fastapi` template covering a Vite +
  React frontend and a FastAPI backend

See [`ANALYSIS.md`](./ANALYSIS.md) §12 for the full implementation roadmap.

---

## License

Proprietary — © Cubocicloide. Internal use only.
