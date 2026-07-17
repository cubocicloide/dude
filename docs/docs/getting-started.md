# Getting started

This guide takes you from nothing to a running project.

---

## Prerequisites

- **Docker Desktop**, running. `dude` runs the whole stack in containers.
- **Node.js ≥ 20** and **pnpm**.
- A **GitHub personal access token** with the `read:packages` scope — `dude`
  ships as a private package on GitHub Packages.

---

## 1. Authenticate the registry (one-time per machine)

Add the `@cubocicloide` scope to your `~/.npmrc`:

```ini
@cubocicloide:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then export the token from your shell profile:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

!!! tip "Verify"
    `npm whoami --registry=https://npm.pkg.github.com` should print your GitHub
    username once the token is picked up.

---

## 2. Install the launcher (the only global install)

```bash
npm install -g @cubocicloide/dude-launcher
```

The launcher is a tiny shim. It never runs your project's logic itself — it
finds the nearest `dude.json`, provisions that project's pinned CLI + stack, and
re-execs them. This is why you only ever install one global package, no matter
how many projects or versions you juggle.

---

## 3. Scaffold a project

```bash
dude init my-app
```

`dude init` asks which stack to use and a few stack-specific questions (database,
background jobs, cloud IaC, …), then writes the project. You can skip the
prompts:

```bash
# Non-interactive: answer everything via flags
dude init my-app --stack react-fastapi --database postgres --celery --yes
```

By default the stack resolves from the **stable** channel. Pass `--next` to try
the newest candidate release. See [release channels](concepts.md#release-channels).

---

## 4. Provision the toolchain

```bash
cd my-app
pnpm install
```

This installs the project's pinned `dude` CLI and stack from the lockfile — the
single source of truth for which versions this project runs.

---

## 5. Start everything

```bash
dude up            # build images + start every service
```

From now on `dude up` starts the project and `dude down` stops it. What's
running depends on your stack and init choices — a typical React + FastAPI
project exposes:

| Service    | URL                            |
| ---------- | ------------------------------ |
| Frontend   | http://localhost:5173          |
| API        | http://localhost:8000          |
| Swagger UI | http://localhost:8000/api/docs |
| Docs site  | http://localhost:8001          |

---

## 6. Explore

```bash
dude help          # live command catalog — reflects your init choices
dude docs          # the project's full docs at http://localhost:8001
dude info          # environment diagnostics (handy for bug reports)
dude report        # hit a dude bug? file a pre-filled issue for it
```

`dude help` and `dude docs` always reflect the **resolved** command set: core
commands, your stack's commands, and any project-local commands. That's the
authoritative reference for the project you just created — this site documents
`dude` itself, not the generated project.
