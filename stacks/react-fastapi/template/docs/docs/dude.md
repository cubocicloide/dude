# Working with dude

[`dude`](https://github.com/cubocicloide/dude) is the project CLI — a single
entry point for all development tasks. Run `dude help` for a live overview.

---

## Installation

```bash
npm install -g @cubocicloide/dude
# or
pnpm add -g @cubocicloide/dude
```

Verify:

```bash
dude --version
```

---

## Getting started

### First run

```bash
# Build images and start all services — required the very first time
dude up --build
```

From the second run onward:

```bash
dude up
```

Also re-run `dude up --build` whenever you change a `Dockerfile` or
`pyproject.toml`.

### Services

Once the stack is up, open these URLs:

| Service | URL | Notes |
|---------|-----|-------|
| **Frontend** | http://localhost:5173 | React + Vite — HMR active |
| **API** | http://localhost:8000 | FastAPI |
| **Swagger UI** | http://localhost:8000/docs | Interactive API explorer |
| **ReDoc** | http://localhost:8000/redoc | API reference docs |
| **Health** | http://localhost:8000/api/health | JSON health check |
| **Flower** | http://localhost:5555 | Celery task monitor |

### Hot reload

- **Frontend** — Vite HMR is active. Edit any file under `frontend/src/` and
  the browser updates instantly without a full page reload.
- **Backend** — Uvicorn runs with `--reload`. Edit any Python file under
  `backend/app/` and the API restarts automatically within ~1 second.

---

## Infrastructure

All services run in Docker. The `docker-compose.yml` at the project root
defines every service.

| Command | Description |
|---------|-------------|
| `dude up --build` | Build images and start all services |
| `dude up` | Start all services (detached) |
| `dude down` | Stop and remove containers |
| `dude logs` | Follow logs for all services |
| `dude logs backend` | Follow logs for a specific service |
| `dude shell backend` | Open an interactive shell inside a running container |

---

## Code quality

| Command | Description |
|---------|-------------|
| `dude lint` | Run all structural lint checks (naming, layout conventions) |
| `dude format` | Format code — `ruff` (backend) + `prettier` (frontend) |
| `dude upgrade` | Update the pinned `dude` CLI and stack versions for this project |
| `dude review` | Run lint + ESLint + API contract review in one pass |

### Upgrading pinned versions

`dude upgrade` updates version pins only. It does **not** migrate existing
project files.

| Command | Description |
|---------|-------------|
| `dude upgrade` | Upgrade both the CLI pin in `package.json` and the stack pin in `dude.json` |
| `dude upgrade --cli` | Upgrade only `@cubocicloide/dude` |
| `dude upgrade --stack` | Upgrade only the active stack version |
| `dude upgrade --cli --cli-version 0.6.1` | Pin the CLI to an explicit version |
| `dude upgrade --stack --stack-version 5.0.5` | Pin the stack to an explicit version |

If a newer version causes issues, roll back by pinning the previous one again:

```bash
dude upgrade --cli --cli-version 0.6.0
dude upgrade --stack --stack-version 5.0.4
pnpm install
```

---

## API contract (OpenAPI)

The frontend uses a typed API client that is auto-generated from the backend's
OpenAPI spec. **Never edit files under `frontend/src/openapi/` by hand.**

| Command | Description |
|---------|-------------|
| `dude api sync` | Fetch OpenAPI spec from the running backend and regenerate the client |
| `dude api review` | Validate the generated client against the saved spec |

**Workflow** — every time you change a backend route:

```bash
dude api sync
dude api review
git add frontend/src/openapi/
git commit -m "chore(api): sync generated client"
```

---

## Testing

| Command | Description |
|---------|-------------|
| `dude test` | Run all test suites (backend + e2e) |
| `dude test --backend` | pytest only |
| `dude test --e2e` | Playwright + Cucumber only |
| `dude test --e2e --headed` | E2e in a visible browser window |
| `dude test --e2e --report` | E2e with HTML + JSON output to `e2e/reports/` |

---

## Security scanning

All scanners run inside Docker — no host-level tool installation required.
Results are written to `private/sast-reports/latest/`.

| Command | Description |
|---------|-------------|
| `dude security scan` | Run all scanners; exit 1 if new findings ≥ HIGH |
| `dude security scan --only bandit,semgrep` | Run a subset of scanners |
| `dude security scan --fail-on CRITICAL` | Raise the failure threshold |
| `dude security accept` | Re-scan and absorb all findings into the baseline |
| `dude security verify --rule-id B105` | Confirm a specific finding has been fixed |
| `dude security verify --rule-id B105 --remove-resolved` | Fix confirmed → prune from baseline |

**Scanners**:

| Scanner | What it checks |
|---------|---------------|
| `bandit` | Python AST — common security anti-patterns |
| `semgrep` | Multi-language rules (backend + frontend) |
| `trivy-fs` | Filesystem: vulnerabilities, IaC misconfigs, secrets |
| `trivy-image` | Container image CVEs (requires built image) |

**Baseline workflow**:

```bash
dude security scan          # review new findings
# triage: fix what matters, accept acceptable risks
dude security accept        # absorb remaining into security/baseline.json
git add security/baseline.json && git commit -m "chore(security): update baseline"
```

!!! note "Baseline"
    `security/baseline.json` must be committed — it is the source of truth for
    accepted findings. Subsequent scans only flag findings that are **not** in the
    baseline.

---

## Documentation

| Command | Description |
|---------|-------------|
| `dude docs` | Serve this documentation in dev mode at <http://localhost:8001> |
| `dude docs --port 9000` | Use a custom port |

The docs site live-reloads when you edit files under `docs/docs/`.

```bash
dude docs
# → open http://localhost:8001
# → edit docs/docs/*.md
# → browser refreshes automatically
```
