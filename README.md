# dude

> Cubocicloide's internal project scaffolding & code quality CLI.
> Multi-stack, plugin-based, distributed via GitHub Packages.

`dude` bootstraps new projects, enforces conventions, and assists with code
review across all stacks Cubocicloide works with. Each stack ships its own
templates, lint rules, generators, and lifecycle hooks — the CLI is
completely stack-agnostic.

---

## Installation (end users)

> **Prerequisite — GitHub token**
> `dude` and its stack plugins are published on GitHub Packages (private
> registry). You need a GitHub Personal Access Token with **`read:packages`**
> scope.
>
> Generate one at: <https://github.com/settings/tokens>

### 1. Configure the registry

Add the following to `~/.npmrc` (create it if it does not exist):

```ini
@cubocicloide:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Replace `YOUR_GITHUB_TOKEN` with your actual token, or keep the placeholder
and always export the variable before running npm/pnpm:

```bash
export GITHUB_TOKEN=ghp_xxx
```

### 2. Install globally

```bash
npm install -g @cubocicloide/dude
```

### 3. Scaffold a new project

```bash
# Interactive — picks the stack from a menu
dude init

# Or specify the stack directly and skip all prompts
dude init --stack react-fastapi --yes
```

---

## Core commands

Once inside a scaffolded project you have access to the full `dude` command
set. Run `dude help` for the complete list.

| Command                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `dude init`             | Scaffold a new project from a stack template       |
| `dude up [--build]`     | Start services (`--build` to rebuild images first) |
| `dude down`             | Stop and remove containers                         |
| `dude logs [service]`   | Stream logs (omit service to follow all)           |
| `dude shell <service>`  | Open a shell inside a running container            |
| `dude lint`             | Run all stack convention checks                    |
| `dude format`           | Format backend (ruff) + frontend (prettier)        |
| `dude review`           | lint + ESLint + API contract review in one pass    |
| `dude test`             | Run all test suites (backend + e2e)                |
| `dude api sync`         | Fetch OpenAPI spec → generate typed client         |
| `dude api review`       | Validate the generated client against the spec     |
| `dude db makemigration` | Generate a new Alembic migration (postgres stack)  |
| `dude db migrate`       | Apply pending migrations                           |
| `dude db rollback`      | Revert the last migration                          |
| `dude docs`             | Serve the project docs at http://localhost:8001    |
| `dude security scan`    | Run SAST scanners (bandit, semgrep, trivy)         |
| `dude help`             | Show all available commands for the current stack  |

### Service URLs (react-fastapi stack, after `dude up`)

| Service  | URL                              |
| -------- | -------------------------------- |
| Frontend | http://localhost:5173            |
| API      | http://localhost:8000            |
| Health   | http://localhost:8000/api/health |
| Docs     | http://localhost:8001            |

---

## Repository layout

```
dude/
├── packages/
│   └── dude/            # @cubocicloide/dude — CLI runtime
└── stacks/
    └── react-fastapi/   # @cubocicloide/stack-react-fastapi
        ├── src/
        │   └── commands/lint/checks/  # BE / FE / E2E lint rules
        ├── template/                  # base scaffold (all projects)
        ├── template-postgres/         # overlay for --database postgres
        ├── template-celery/           # overlay for --celery
        └── template-celerybeat/       # overlay for --celerybeat
```

---

## Contributing (monorepo setup)

```bash
# 1. Clone
git clone git@github.com:cubocicloide/dude.git
cd dude

# 2. Authenticate
export GITHUB_TOKEN=ghp_xxx

# 3. Install & build
make install
make build

# 4. Run the CLI from sources
make cli ARGS="--help"
make cli ARGS="init --stack react-fastapi"
```

### Common Makefile targets

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

## Releasing

```bash
make changeset   # interactively record a version bump
# → on merge to main, CI opens a "Version Packages" PR
# → merging that PR publishes to GitHub Packages automatically
```

---

## License

Proprietary — © Cubocicloide. Internal use only.
