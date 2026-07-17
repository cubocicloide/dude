# dude

[![CI](https://github.com/cubocicloide/dude/actions/workflows/ci.yml/badge.svg)](https://github.com/cubocicloide/dude/actions/workflows/ci.yml)
[![License: source-available](https://img.shields.io/badge/license-source--available-blue.svg)](LICENSE)

> Cubocicloide's project scaffolding & code-quality CLI.
> Multi-stack, plugin-based, distributed via GitHub Packages.

`dude` turns a blank directory into a running, production-shaped project — frontend,
backend, database, background jobs, tests, security scanning, docs, and cloud
infrastructure — all wired together and following the same conventions across
every team. You pick a **stack**; `dude` scaffolds it, lints it, runs it, and
ships it.

```bash
dude init my-app        # scaffold
cd my-app && pnpm install
dude up                 # everything running in Docker
```

---

## Quick start

**Prerequisites**

- **Docker Desktop**, running.
- **Node.js ≥ 20** and **pnpm**.
- A GitHub [personal access token](https://github.com/settings/tokens) with
  `read:packages` — `dude` ships as a private GitHub Package.

**1. Authenticate the registry** (one-time per machine). Add to `~/.npmrc`:

```ini
@cubocicloide:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

…and export a token from your shell profile:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

**2. Install the launcher** — the only global install:

```bash
npm install -g @cubocicloide/dude-launcher
```

**3. Scaffold and run:**

```bash
dude init my-app        # pick a stack, answer a few questions
cd my-app
pnpm install            # provision the pinned toolchain from the lockfile
dude up                 # build images + start every service
```

From the second run onward: `dude up` starts everything, `dude down` stops it.

---

## Stacks

Pick one at `dude init` with `--stack <id>`:

| Stack           | What it scaffolds                                                        |
| --------------- | ------------------------------------------------------------------------ |
| `react-fastapi` | React 19 + FastAPI web app; optional Postgres, Celery, AWS EKS IaC       |
| `react-django`  | React + Django REST Framework; optional S3 storage, Celery, AWS ECS IaC  |
| `fastmcp`       | FastMCP (Python) server — modular MCP sub-servers; optional AWS ECS IaC  |
| `tauri`         | Tauri 2 app — desktop + iOS/Android (React + antd + Rust)                |
| `frappe`        | Frappe Helpdesk ticketing system + custom app; optional AWS ECS IaC      |
| `airflow`       | Apache Airflow deployment with example DAGs; optional SSO + ECS IaC      |

---

## Documentation

The extended documentation — what `dude` is, how it works, the stack catalog,
the command reference, and troubleshooting — lives in [`docs/`](docs/) as a
MkDocs Material site. Serve it locally:

```bash
make docs          # → http://localhost:8001
```

Inside a **generated project**, run `dude docs` for that project's own reference
and `dude help` for the live command catalog (it reflects your init choices).
Stuck? `dude info` prints an environment report, and `dude report` files a
pre-filled bug report against dude for you.

---

## Contributing

Working on the CLI runtime, the launcher, or a stack plugin? See
[CONTRIBUTING.md](CONTRIBUTING.md) for the build, dev-scaffold, testing, and
release workflows, and [CLAUDE.md](CLAUDE.md) for the full command reference and
repo invariants.

Found a bug or have a feature idea? Open an
[issue](https://github.com/cubocicloide/dude/issues) — the form will guide you.

---

## License

**Source-available, proprietary** — © Cubocicloide. All rights reserved.

The source is public for transparency and evaluation, but it is **not**
open-source: use, copying, modification, and redistribution require prior
written permission. See [LICENSE](LICENSE) for the full terms. To report a
security issue, see [SECURITY.md](SECURITY.md).
