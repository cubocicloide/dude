# @cubocicloide/stack-react-fastapi

## 13.3.0

### Minor Changes

- b84d626: Fix the CRITICAL/HIGH findings `dude security scan` reports on a fresh scaffold.

  - **RDS security group** egress is restricted to the VPC CIDR instead of
    `0.0.0.0/0` (AVD-AWS-0104).
  - **ECR repositories** are now `IMMUTABLE` (AVD-AWS-0031). To keep that
    workable, the default image tag gained a digest of the uncommitted diff —
    `<sha>-dirty-<hash>` rather than a constant `-dirty` — so iterating on a
    branch produces a fresh tag each time. Re-pushing a tag that already exists
    now fails fast, before the build, with the three ways out (commit, `--tag`,
    or just `dude iac deploy` the image already in ECR).
  - **Production images run unprivileged** (DS002): the backend creates `appuser`
    before building the virtualenv, so no `chown -R` layer duplicates it, and the
    frontend moves to `nginxinc/nginx-unprivileged`. That image cannot bind a
    privileged port, so nginx and the Helm `frontend.port` value both move to
    8080 — the ALB still listens on 80/443.
  - **Development images stay root**, and DS002 is silenced for them through a
    new `security/.trivyignore.yaml`. They bind-mount your source tree, and a
    fixed UID breaks writes back into it (`dude db makemigration`) on any host
    whose UID is not 1000.
  - **Trivy no longer reports third-party Terraform modules**
    (`--tf-exclude-downloaded-modules`, plus `.terraform` in `--skip-dirs`). Once
    `dude iac init` has run, the vendored VPC/EKS module source is what produced
    AVD-AWS-0130 and one of the two AVD-AWS-0104 hits — findings in code nobody
    using this stack can act on.
  - **Terraform state is encrypted with a customer managed KMS key**
    (AVD-AWS-0132), key rotation on and a bucket key to keep KMS request costs
    flat. State holds every resource attribute, the generated RDS password
    included, so it is worth an auditable, revocable key.
  - **GHSA-qwww-vcr4-c8h2** (react-router) is recorded as not applicable: it is a
    CSRF bypass in RSC mode, which a Vite SPA never enters, and the only fix is
    the 8.x major. The ignore entry expires 2027-02-01 so it comes back for
    review rather than disappearing.

  A fresh `--iac aws-eks` scaffold now scans clean: `dude security scan` reports
  0 CRITICAL and 0 HIGH, down from 2 and 9.

  No IMDSv2 override is added to the EKS node group: the module already defaults
  `http_tokens` to `required`, and since it replaces `metadata_options` wholesale
  rather than merging, setting only `http_tokens` would silently drop
  `http_put_response_hop_limit` from 2 to 1 and cut pods off from instance
  metadata.

## 13.2.0

### Minor Changes

- eb3892a: Scaffold a Stripe-style API reference at `/api/docs` in both stacks.

  Swagger UI (react-django) and Swagger UI + ReDoc (react-fastapi) are replaced by a
  single Scalar reference — three-pane layout, brand accent, live Test Request.

  Each scaffold now ships a hand-written narrative alongside the generated schema:

  - react-django — `backend/config/api_docs.py` (`API_DESCRIPTION`, `API_TAGS`), wired
    into `SPECTACULAR_SETTINGS`; the page lives at `backend/templates/api-docs.html`.
  - react-fastapi — `backend/app/core/api_docs.py` (`API_DESCRIPTION`, `API_TAGS`,
    `scalar_html`), wired into the `FastAPI(...)` constructor.

  Every scaffolded endpoint carries a tag, an imperative summary and a description
  that says something the schema does not, so `dude api sync` and the reference both
  start out complete.

## 13.1.0

### Minor Changes

- 76931e9: Add `dude cheatsheet` — one dense, answer-aware reference for the project you are
  standing in: how it was scaffolded, the verify loop (only steps this project
  actually has), every lint rule with its one-line title, the top-level layout, and
  the full command catalog. Everything is derived from the live catalog and the
  project's own `.claude/rules/` files, so it stays correct as init answers, stack
  versions and project-local commands change.

  `--format json` emits the same data with a `dude.cheatsheet/1` schema marker and
  the command catalog embedded, so a coding agent gets what it may run and what will
  be checked in a single fetch instead of crawling a documentation site.

  The renderer lives in the CLI (`generateCheatsheet`) and every stack registers the
  shared command with `defineCheatsheetCommand()`, mirroring `defineLintCommand()` —
  never hand-roll a per-stack cheatsheet.

- 22fb522: Add an optional `docs` manifest to the stack contract (`StackDefinition.docs`), validated with a new `stackDocsSchema` (exported alongside `StackDocs`) that follows the existing `stackVariableSchema` pattern — plain, serializable data, so it stays safe to pass to future tooling. `loadStack` now validates a declared manifest at load time and throws a descriptive error if it is malformed, so a bad manifest fails loudly instead of silently degrading downstream.

  All six stacks (`react-fastapi`, `react-django`, `fastmcp`, `tauri`, `frappe`, `airflow`) now populate the manifest: a one-line tagline, "if you're building…" use cases, headline technologies, the IaC target (when the stack has one), and the exact page set the stack's scaffold ships under `docs/docs/` (including the conditional `deploy.md` from the IaC overlay). No user-visible output changes in this slice — the manifest is typed data for the root-site composer and other documentation tooling to consume in a following change (see issue #113).

- 76931e9: Give coding agents a real entry point in every scaffolded project.

  - **`AGENTS.md`** — a thin pointer for non-Claude agents: ask the project what it
    is with `dude cheatsheet --format json`, read the conventions in `CLAUDE.md` and
    `.claude/rules/`, then verify with `dude lint` and `dude test`. Deliberately a
    pointer rather than a second copy of the guidance, because duplicated
    instructions drift.
  - **`CLAUDE.md`** now opens with the cheatsheet: one call returns the project's
    live command catalog, every lint rule, the verify loop and the init answers, so
    an agent should prefer it over any hand-written command list in the file.

  Both lean on the same idea: this project's conventions are enforced mechanically,
  so an agent can check its own output rather than guess.

- 76931e9: Move the `docs` command into the CLI as `defineDocsCommand()`, which every stack
  now registers — the same pattern as `defineLintCommand()`. The six stacks were
  carrying byte-identical 117-line copies, so adding a generated page meant editing
  six places; it is one place now.

  The shared command refreshes every generated page the scaffold ships before
  serving: `api.md` from the live command catalog, and `cheatsheet.md` from the
  project's rules and answers. Each refresh is independent and best-effort, so a
  failure leaves the committed placeholder and never blocks serving.

  Each stack's project documentation site now includes a **Cheatsheet** page,
  regenerated on every `dude docs` and pointing coding agents at
  `dude cheatsheet --format json`.

### Patch Changes

- 76931e9: Fix two correctness bugs found reviewing the docs-composition work.

  **A stack newer than the running CLI now fails legibly.** A stack's module body
  calls the CLI's `define*Command()` helpers while building its `commands` map, so it
  throws while being _imported_ — before `minDudeVersion` can be read, and for every
  command rather than only the one needing the new API. Previously that surfaced as a
  raw Node stack trace. `cli.ts` now catches the load failure and explains it, and
  core commands (`version`, `upgrade`, `info`) fall through and keep working, since
  `dude upgrade --cli` is the way out of exactly this situation.

  **`dude cheatsheet` no longer reports disabled rules as enforced.** It read
  `.claude/rules/` directly and ignored `dude.json` → `lint.disable`, which the lint
  engine honours — so a project that switched a code off still saw it listed under
  "rules `dude lint` runs". Disabled codes are now excluded and stated in their own
  section, project-local checks under `.dude/lint/checks/` are included (they run but
  ship no prose file), and each rule says which source it came from.

  Also: the core command registry is now defined once (`coreCommands`) and drives
  citty's dispatch, the published catalog and the tests, instead of two
  hand-maintained lists that had already drifted; `catalogToMarkdown` takes a
  `standalone` option instead of being string-spliced by its caller; a malformed
  `dude.json` produces a warning instead of a silently truncated page; and the
  catalog is resolved once per render rather than two or three times.

- 76931e9: Fix four defects found reviewing the previous round of fixes.

  **`dude init` no longer dumps a stack trace when the stack is newer than the CLI.**
  The earlier guard only covered commands run inside an existing project; `init`
  resolves the stack itself, and that is the path every _new_ project takes. Since
  promotion to `latest` is per-package, a stack promoted before the CLI reproduced
  this for real users. The version-skew advice is also now offered **conditionally** —
  appending it to every failure told people to run `dude upgrade --cli` right after
  the loader had correctly told them to build the stack.

  **A malformed `dude.json` is explained instead of crashing.** The dispatcher parsed
  it unguarded, so _every_ command in such a project died with a raw `SyntaxError`,
  including the ones needed to fix it. `readDisabledCodes` had the same hole.

  **`dude cheatsheet` now derives the enforced rule set from the lint engine itself**
  (`discoverCheckCodes`), not from the project's `.claude/rules/` prose directory.
  Those are two independently-mutable trees, so the page could omit a rule that runs
  (stale prose after `dude upgrade --stack`) or invent one that does not (leftover
  prose), and its own copy of the loadable-extension list had already lost `.mts`.
  Rule files now supply only titles. A stack/project code collision — which makes
  `runLint` refuse to run at all — is reported instead of silently resolved.

  **The composer validates its own tables.** Escaping there had been wrong three
  times; the check now fails the build on a row whose cell count does not match its
  header, or on a value escaped twice.

- Updated dependencies [76931e9]
- Updated dependencies [22fb522]
- Updated dependencies [76931e9]
- Updated dependencies [76931e9]
- Updated dependencies [76931e9]
- Updated dependencies [76931e9]
  - @cubocicloide/dude@0.16.0

## 13.0.8

### Patch Changes

- Updated dependencies [36aace0]
  - @cubocicloide/dude@0.15.1

## 13.0.7

### Patch Changes

- f331a76: Document `dude info` and `dude report` in the generated project's "Working with dude" docs page, so a bug in dude itself (rather than the app) has a clear, discoverable path to a well-formed report.

## 13.0.6

### Patch Changes

- Updated dependencies [e38638f]
  - @cubocicloide/dude@0.15.0

## 13.0.5

### Patch Changes

- Updated dependencies [f8bfe29]
  - @cubocicloide/dude@0.14.0

## 13.0.4

### Patch Changes

- 12f0855: Add a short "Search" note to the generated project's "Writing docs" page (`docs/docs/mkdocs.md`), pointing out the MkDocs Material search shortcut (`/`).

## 13.0.3

### Patch Changes

- 59902ae: Fix `dude init` failing with `Cannot find package '@cubocicloide/dude'` when a stack is resolved via the cache-install path (fresh machine, no existing workspace/project). `@cubocicloide/dude` is imported unbundled at runtime (`external` in tsup) but had only been declared in `devDependencies` since #78 removed the redundant `peerDependencies` entry — devDependencies are never installed for a package consumed as someone else's dependency, so nothing pulled `@cubocicloide/dude` into `~/.dude/cache/stacks/…/node_modules`. Moved it to a real `dependencies` entry (still `workspace:*`, rewritten to an exact version at publish) instead of `peerDependencies`, so it installs correctly without reintroducing the changesets peer-range major-bump bug.

## 13.0.2

### Patch Changes

- 9e04258: Add an "Extending this site" callout to the generated project's docs home page (`docs/docs/index.md`), pointing to `docs/docs/` as the source and linking to the "Writing docs" page.

## 13.0.1

### Patch Changes

- c93f206: Drop the redundant `peerDependencies` on `@cubocicloide/dude` from every stack. It duplicated the `devDependencies` pin and served no functional purpose (scaffolded projects pin `dude` directly; runtime compatibility is enforced by `minDudeVersion`). The `workspace:^` form also triggered a Changesets bug that forced a spurious **major** bump on every stack whenever `dude` was released; with the peer entry gone, a `dude` release no longer re-versions the stacks at all.

## 13.0.0

### Patch Changes

- 628eb2b: Document the `dude upgrade --next` flag in the generated project's docs (Code quality → Upgrading pinned versions).
- Updated dependencies [628eb2b]
  - @cubocicloide/dude@0.13.0

## 12.0.0

### Minor Changes

- 397fef5: Project-defined lint rules, uniform across every stack.
  - `dude lint` now also runs project checks from `.dude/lint/checks/<GROUP>/<id>.ts`
    (loaded via jiti — real TypeScript, project imports allowed), under the same
    `CheckFn` contract stack checks use; the rule code is derived from the path.
  - A code defined twice (stack + project, or twice in the project) is a hard
    error; stack rules can be disabled per-project via `dude.json` →
    `lint.disable: ["BE003", …]` (unknown codes produce a notice).
  - New `defineLintCommand()` export in `@cubocicloide/dude`; all stacks now
    register their `lint` command through it instead of hand-rolled wrappers
    (the stacks' peer range on `@cubocicloide/dude` moves to `^0.12.0`
    accordingly — upgrade both pins together with `dude upgrade`).
  - Scaffolds ship a `.dude/lint/checks/` README + `PRJ/001.ts` starter example,
    and the generated docs describe project lint rules.

### Patch Changes

- Updated dependencies [397fef5]
  - @cubocicloide/dude@0.12.0

## 11.0.1

### Patch Changes

- c3af02d: Add a default favicon to the base template (`frontend/public/favicon.svg`, wired into `index.html`) so scaffolded projects don't ship with a blank browser tab icon. It's a simple placeholder — swap it for your own.
- c3af02d: Fix two issues found in the `$`-structure frontend overhaul (major release `11.0.0`):
  - **FE lint severity.** FE002, FE005, FE006, FE009, and FE010 now report unrecognized files/directories as **errors** instead of warnings — an unexpected item in a fixed-membership directory (component, hook, page, utils domain, src root) is a structural violation, not a suggestion.
  - **Postgres 500 on a fresh `dude up`.** The postgres template shipped no committed Alembic migration for the `User` model, so `alembic upgrade head` (run automatically on every backend container start) was a no-op — the `user` table was never created unless `dude reset` had been run at least once, causing `/api/users` to 500 on a database that only ever saw `dude up`. Added the missing initial migration (`0001_create_user_table`) so the schema is created on the very first `dude up`. The README, docs `index.md`, and docs `dude.md` now also explain (conditionally, for postgres projects) that `dude reset` is still needed once to seed demo data.

## 11.0.0

### Major Changes

- 97410a6: Frontend structure overhaul: privileged `$`-directories, zustand, and 12 FE lint rules.

  **New frontend layout (breaking for scaffolded projects).** The frontend tree is now organised in scopes with privileged `$`-prefixed folders that sort on top and can never be confused with a route segment or domain name:
  - `components/` → `$components/`, `hooks/` → `$hooks/` (both nestable inside components and pages — matrioska).
  - Every scope (component, hook, page, utils domain) owns the same file set: `index.tsx`, `styles.module.css`, `types.tsx`, `constants.tsx`, `functions.tsx`, plus `$assets/` (non-code files only) and `$misc/` (check-exempt escape hatch, always warned).
  - `index.css` → `styles.module.css` (global selectors via `:global(...)`).
  - New `$types/` folder holds every `*.d.ts` (e.g. `vite-env.d.ts`).
  - `utils/` is now organised in kebab-case domains (e.g. `utils/formatters/`).
  - Page route segments must be kebab-case or a dynamic `[param]` (e.g. `pages/users/[id]/`).

  **Lint.** FE001–FE008 rewritten for the `$`-structure; new FE009 (utils domains), FE010 (src root layout + `$types`), FE011 ($misc warning with relocation guidance), FE012 (index.tsx hygiene: types → `types.tsx`, helpers → `functions.tsx`, extra components/hooks → `$components/`/`$hooks/`). All `.claude/rules/FE/\*.md` updated in the template.

  **Zustand.** Added `zustand` to the scaffold dependencies with an example store (`$hooks/useCounterStore/`, devtools middleware enabled only in dev) and a demo card on the home page.

  **Postgres template.** New `/users` and `/users/[id]` pages (antd Table + Descriptions over the generated OpenAPI client), conditionally wired into `App.tsx` and the Layout sidebar (menu entries now live in `$components/Layout/constants.tsx`).

  **Fixes.** Frontend `tsconfig.json` now sets `noEmit: true` — `npm run build` (`tsc -b`) used to emit stray `.js` files into `src/`. ESLint disables `react-refresh/only-export-components` under `src/utils/` (utils never export components).

## 10.1.3

### Patch Changes

- be9764c: fix(windows): make dude process execution reliable on win32

  Windows needs `shell: true` for `spawnSync`/`execFileSync` to resolve
  package-manager shims (`.cmd`/`.bat` — pnpm, npm, npx, uv) that aren't real
  executables; without it, spawning them throws `ENOENT` even though the tool
  is on PATH. Every stack command that shells out to a tool other than
  `docker` (a real executable, unaffected) now opts into shell execution on
  `win32` only, and reports `result.error` instead of silently treating a
  failed spawn as a plain non-zero exit. `docs`'s browser launcher now uses
  `cmd /c start` on Windows (bare `start` is a cmd.exe builtin, not a program).

  Covers `dude-launcher` (pnpm/npx install), the CLI core (`dude upgrade`,
  stack resolution/install), and the fastmcp, react-django, react-fastapi,
  tauri and airflow stacks (docs, format, review, test, iac shared exec).

- Updated dependencies [be9764c]
  - @cubocicloide/dude@0.11.6

## 10.1.2

### Patch Changes

- e465421: fix(iac): destroy the shared backend + ECR when the last env is torn down

  `dude iac destroy` decided whether to tear down the shared bootstrap (S3 state
  bucket + DynamoDB lock + ECR repos) by listing the environment _folders_ on
  disk. But a folder (`backend.hcl` + `terraform.tfvars`) survives a
  `terraform destroy`, so after destroying `staging` then `dev`, the guard still
  saw the leftover `staging/` folder and concluded the backend was "still in use"
  — refusing to ever tear it down. The shared S3 bucket, DynamoDB table and ECR
  repositories were orphaned even though no live infrastructure remained.

  Liveness is now read from each sibling environment's **remote Terraform state**
  (empty `resources` after a destroy) instead of the on-disk folder, so the last
  environment's teardown correctly removes the shared backend + ECR. The decision
  is logged per sibling, and an unreadable-but-present state is treated as live so
  a transient read error never wipes another env's backend.

## 10.1.1

### Patch Changes

- a58348d: fix(iac): pin the cluster context for `status`/`deploy`/`destroy`, not just `shell`

  The containerized `kubectl`/`helm` calls behind `dude iac status`, `deploy` and
  `destroy` inherited the host's kubectl _current-context_. In the normal flow
  (you just ran `dude iac kubeconfig --env <env>`) that's the right cluster, but if
  your current-context was left on another project/env, those commands silently
  acted on the wrong cluster.

  `run`/`capture` now take an optional `kube` target ({cluster, region, namespace}).
  When routing a kube tool through the runner, the invocation is wrapped in a
  prelude that builds a dedicated in-container kubeconfig for that exact cluster
  (`aws eks update-kubeconfig`) and selects the namespace — so `status`/`deploy`/
  `destroy` always target the env named by `--env`. The prelude is silent on
  stdout (so captured output stays clean) and, if the cluster is unreachable,
  falls back to the mounted `~/.kube` with a stderr warning rather than guessing.

  The cluster name follows the scaffold convention (`<project>-<env>`); the region
  comes from the env's tfvars. The native fallback path (`DUDE_IAC_RUNNER=host` or
  no Docker) is unchanged — it still uses the host kubeconfig as-is.

- 457d069: fix(iac): `dude iac shell` pins the kube context + namespace to the target env

  `dude iac shell --env <env>` mounted the host `~/.kube` read-only and dropped you
  into a shell on whatever your host's _current-context_ happened to be — which
  might be a different cluster (e.g. another project, or `prod` while you asked for
  `dev`). It also opened on the `default` namespace, so `k9s`/`kubectl get pods`
  looked empty even when the app was running in the env's namespace.

  The shell now builds a dedicated in-container kubeconfig for the env's own
  cluster (`aws eks update-kubeconfig` against the mounted credentials) and selects
  the env's namespace, so `kubectl`/`helm`/`k9s` target the right cluster + see the
  right pods immediately. If the cluster can't be reached (not provisioned yet,
  bad creds) it falls back to the mounted `~/.kube` with a warning rather than
  silently acting on the wrong cluster.

## 10.1.0

### Minor Changes

- f0f4be4: feat(iac): run the IaC toolchain in a Docker runner + add `dude iac shell`

  `dude iac *` shelled out to terraform/kubectl/helm/k9s on the host, forcing the
  customer to install and version-match all of them — a portability and
  reproducibility problem across operating systems.

  These tools now run inside a pinned container built from the scaffold's own
  `iac/runner/Dockerfile` (customer-owned and editable; the image is tagged by a
  hash of that file, so any edit rebuilds automatically). Routing is transparent:
  a provider-local `exec.ts` wraps the generic `run`/`capture` and rewrites
  containerized-tool invocations into `docker run …`, mounting the working
  directory at `/work` so the relative paths the commands already use resolve
  unchanged. Credentials are never baked in — `~/.aws` (profiles + SSO cache) and
  `~/.kube` are mounted in and `AWS_PROFILE` is passed through, so named profiles
  and SSO keep working exactly as before.

  `aws` and `docker build/push` stay on the host (the host needs `aws` for the SSO
  browser in `dude iac login` anyway, and image builds need the host daemon).
  Everything else — terraform/kubectl/helm — runs in the container. Set
  `DUDE_IAC_RUNNER=host` to use native tools instead; `dude iac` also falls back to
  native automatically when Docker isn't running.

  New command **`dude iac shell --env <env>`** opens an interactive shell in the
  runner with the full toolchain + k9s, the env's AWS profile and the cluster
  kubeconfig already wired — for ad-hoc inspection or changes.

## 10.0.1

### Patch Changes

- c85d96b: fix(iac): `dude iac new-env` now also copies the per-env Helm values file

  `new-env` only copied the Terraform environment folder
  (`iac/terraform/environments/<name>`), leaving the new env without a
  `helm/app/values-<env>.yaml`. Since that file is gitignored and optional at
  deploy time, the new environment would silently deploy with the bare
  `values.yaml` defaults instead of the source env's overrides (replicas,
  autoscaling, config, secrets) — a quiet footgun, despite the command's "copy an
  existing one" contract.

  `new-env` now copies `values-<from>.yaml` → `values-<env>.yaml` when the source
  file exists on disk, and the success message + docs reflect it. No change when
  the source env has no values file (deploy still falls back to `values.yaml`).

## 10.0.0

### Minor Changes

- 2a23f16: Harden the AWS EKS IaC target end-to-end and add a live, auto-generated command reference.

  **@cubocicloide/dude**
  - `dude help --format md` / `--format json` (also `--md` / `--json`) emit the full,
    init-aware command catalog (core + active stack + project-local `.dude/commands/`)
    as Markdown or JSON — useful for docs and LLM/tooling consumption.
  - New public API `generateApiDoc(cwd, format)` so stacks can render that catalog
    (e.g. to regenerate a docs page) without shelling out.

  **@cubocicloide/stack-react-fastapi**
  - `dude docs` now regenerates `docs/api.md` from the live command catalog before
    serving, so the documented API always matches the project's actual commands
    (gitignored; also printable via `dude help --format md`).
  - IaC: ECR repositories are now **shared across environments** and owned by the
    `bootstrap` config (one image, promoted by tag), instead of being recreated per
    env — this avoids `RepositoryAlreadyExistsException` and stops one env's destroy
    from deleting another's registry. Repo URLs are derived from the account id
    (`aws_caller_identity`), so plan/apply/destroy no longer depend on the ECR API.
  - IaC: `dude iac destroy` now removes the Route53 records external-dns created for
    the env, guards the shared backend (S3 + DynamoDB + ECR) so it is torn down only
    with the **last** environment, and auto-retries after clearing leftover
    Kubernetes networking (load-balancer security groups and dangling CNI ENIs) that
    otherwise block VPC/subnet deletion with `DependencyViolation`.
  - IaC: `dude iac init` now passes `-reconfigure`, so switching `--env` against the
    shared Terraform working directory no longer fails with "Backend configuration
    changed".
  - IaC fixes: pin the RDS endpoint alongside DynamoDB/S3 (avoids a local DNS lookup
    failure during bootstrap/apply); `db_engine_version` defaults to `"17"`.
  - Docs: the generated project's docs now include a conditional IaC command section,
    a new "Command reference" page, and an expanded deploy guide (adding environments,
    multi-env teardown).

### Patch Changes

- 1ac9cd3: Fix the getting-started documentation in generated projects.
  - Correct the global install: it's `@cubocicloide/dude-launcher` (not `@cubocicloide/dude`).
  - Document the private GitHub Packages registry auth (`~/.npmrc` + `GITHUB_TOKEN`).
  - Add the correct lifecycle order: launcher → `dude init` → `pnpm install` → `dude up --build`.
  - Note for users who cloned an existing project to skip `dude init` and start at `pnpm install`.
  - Add a documentation-site section (`dude docs`) to the README.
  - `docs/index.md` now has a full Getting started block and links to `api.md` / `deploy.md`.

- Updated dependencies [2a23f16]
  - @cubocicloide/dude@0.11.0

## 9.0.0

### Minor Changes

- bd506ab: Add an AWS EKS Infrastructure-as-Code target (Terraform + Helm) and conditional command visibility.

  **@cubocicloide/dude**
  - `StackCommandDef` gains an optional `available(projectRoot)` predicate. When it
    returns `false`, `dude help` hides that command (and empty groups are dropped).
    This lets a stack expose feature-gated commands that only appear when the
    matching init answer was chosen.
  - `dude help` now also hides the PostgreSQL-only `db` group on projects scaffolded
    without a database.

  **@cubocicloide/stack-react-fastapi**
  - New `iac` init option (`none` | `aws-eks`). Choosing `aws-eks` scaffolds an
    `iac/` directory with Terraform (VPC, EKS, ECR, AWS Load Balancer Controller,
    and managed RDS PostgreSQL when `--database postgres`) and a Helm chart for the
    application (backend, frontend, in-cluster Redis + Celery worker/beat/Flower
    when enabled, ALB Ingress, migration hook). The generated assets reflect the
    other answers (`postgres`/`celery`/`celerybeat`).
  - Terraform uses an S3 + DynamoDB remote backend configured per-environment, so
    the same flow works locally and in CI/CD. Environments scale by copying a
    folder (`environments/dev` ships by default); a `bootstrap/` config creates the
    state bucket + lock table once.
  - New `dude iac` command group — `init`, `plan`, `apply`, `destroy`, `output`,
    `fmt`, `validate`, `kubeconfig`, `deploy`, `status` — all `--env`-scoped. The
    group is shown **only** in IaC-enabled projects.
  - Production Dockerfiles (`backend/Dockerfile.prod`, `frontend/Dockerfile.prod`
    - `nginx.conf`) are added for building the images deployed to EKS.

### Patch Changes

- Updated dependencies [bd506ab]
  - @cubocicloide/dude@0.10.0

## 8.1.0

### Minor Changes

- 6af687a: Add guided scaffolding skills to the generated `.claude/skills/`.

  Scaffolded projects now ship three Claude skills that scaffold new code while
  enforcing the stack's structural rules and reusing existing code:
  - `/create` — router skill: asks whether you want a backend route or a frontend
    page, then runs the matching flow.
  - `/create-route` — asks for the path, method(s) and response shape, surveys
    existing schemas/queries/routers for reuse, creates the router and registers
    it in `main.py`, adds any model/query/schema, writes the 1-to-1 tests, and
    regenerates the typed frontend client. Enforces the `BE` rules.
  - `/create-page` — asks for the route path and what to display, surveys the
    shared component library, hooks and generated API client for reuse, creates
    the page directory, wires the route into `App.tsx`, and adds any new
    components/hooks. Enforces the `FE` rules.

## 8.0.0

### Minor Changes

- 2633e97: Add project-local custom commands under `.dude/commands/`.

  Any scaffolded project can now define its own `dude` commands by dropping a file
  in `.dude/commands/` — one file per command, named after the file (`reset.ts` →
  `dude reset`). No registration step.

  **@cubocicloide/dude**
  - New `defineCommand` helper exported from the package for authoring custom
    commands with full type-checking.
  - Custom commands are loaded with [jiti](https://github.com/unjs/jiti), so they
    can be written in TypeScript and `import` any package installed in the project
    (imports resolve against the project's own `node_modules`). `.mjs`/`.js` work too.
  - Dispatch precedence is **custom > stack > core**: a `.dude/commands/up.ts`
    overrides the stack's `up`. The dispatch hot path lazily loads only the invoked
    command, so unrelated command modules are never imported.
  - The core commands `init`, `upgrade`, `version`, and `help` are reserved and
    cannot be overridden.
  - `dude help` shows custom commands under a **PROJECT COMMANDS** section and
    marks overrides; load/validation failures surface as warnings.

  **@cubocicloide/stack-react-fastapi**
  - Scaffold ships a `.dude/commands/` directory with a `hello` example command
    and a `README.md` documenting the full contract.
  - PostgreSQL projects additionally get `dude reset` (drop DB → restart services →
    migrate → seed demo data) as a ready-to-use custom command under `.dude/commands/`.

### Patch Changes

- Updated dependencies [2633e97]
  - @cubocicloide/dude@0.9.0

## 7.0.0

### Minor Changes

- 7c1bb4d: Add global launcher, lockfile-backed version pinning, and OpenAPI pre-generation at init.

  **@cubocicloide/dude-launcher** (new package)
  Global shim installed once per machine (`npm i -g @cubocicloide/dude-launcher`). Walks up to the nearest `dude.json`, ensures the project's pinned CLI + stack are installed via the project's package manager, then re-execs `node_modules/.bin/dude`. Works from any subdirectory; `DUDE_SKIP_PROVISION` escape hatch for CI.

  **@cubocicloide/dude**
  - CLI and stack are now both pinned as exact `devDependencies` in the scaffolded `package.json` (lockfile-enforced); the `~/.dude` cache is a fallback only for `dude init` on bare machines.
  - `dude upgrade --stack` now updates `package.json` and `dude.json` in lockstep.
  - `minDudeVersion` declared by each stack is now enforced at runtime before any stack command runs.
  - New `satisfiesMinVersion` semver utility.
  - `StackContext` gains `stackVersion` so Handlebars templates can reference `{{stackVersion}}`.

  **@cubocicloide/stack-react-fastapi**
  - `dude init` pre-generates the full typed OpenAPI client from the bundled `openapi.yaml` template, making `dude api sync` a no-op until backend routes actually change.
  - `dude format` and `dude review` now invoke prettier/ESLint via `node_modules/.bin/` directly, avoiding pnpm workspace detection issues when the project root carries `@cubocicloide/...` devDependencies.
  - `scaffold()` passes `stackVersion` to Handlebars data so `package.json.hbs` can pin the correct stack version.

### Patch Changes

- Updated dependencies [7c1bb4d]
  - @cubocicloide/dude@0.8.0

## 6.0.2

### Patch Changes

- 3dc82b2: Fix the docs landing page quick links and refresh the tech stack summary in the generated project documentation.

## 6.0.1

### Patch Changes

- 22fd223: `dude format`: reinstall frontend or e2e dependencies when `node_modules` exists but the required `prettier` binary is missing

## 6.0.0

### Patch Changes

- afdb915: Add `dude upgrade` to update pinned CLI and stack versions in existing projects, and document the upgrade and rollback workflow in the stack and project docs.
- Updated dependencies [afdb915]
  - @cubocicloide/dude@0.7.0

## 5.0.6

### Patch Changes

- 0fd5a7f: `dude format`: auto-install frontend and e2e dependencies before running Prettier

## 5.0.5

### Patch Changes

- 3637c3b: `e2e`: default to `http://localhost:5173` and show a friendly error when the app is not reachable

## 5.0.4

### Patch Changes

- ec60d9b: `dude test`: run `playwright install` after `pnpm install` in e2e/

  After auto-installing e2e node_modules, the test command now also
  runs `pnpm exec playwright install` so Chromium/Firefox/WebKit
  browsers are available before cucumber-js tries to launch them.

## 5.0.3

### Patch Changes

- ed9d90a: `dude test`: auto-install e2e node_modules when missing

  Before running `pnpm run test` in `e2e/`, the test command now checks
  whether `node_modules/` exists and runs `pnpm install` automatically
  if it does not. This fixes the `cucumber-js: command not found` error
  on first run.

## 5.0.2

### Patch Changes

- c0f1659: Fix scaffolded backend test suite to pass out of the box
  - `conftest.py`: switch to `ASGITransport` (httpx ≥ 0.27 dropped `app=` kwarg), make `client` fixture async
  - Postgres overlay `conftest.py`: add `db` fixture (in-memory SQLite via `StaticPool`) and override `get_db` dependency so router tests never need a real Postgres connection
  - `test_user.py`: fix field reference `name` → `full_name` to match the actual `User` model
  - `user.py`: replace deprecated `datetime.utcnow` with `datetime.now(UTC)` (Python 3.13)
  - `config.py.hbs`: replace deprecated `class Config` with `model_config = SettingsConfigDict(...)` (Pydantic v2)
  - `pyproject.toml.hbs`: add `anyio[trio]` dev-dependency and `[tool.pytest.ini_options] asyncio_mode = "strict"`

## 5.0.1

### Patch Changes

- a1c9b91: Update README and template docs with first-run guide, full service URL table (Swagger UI, ReDoc, Flower), and hot reload instructions
- Updated dependencies [a1c9b91]
  - @cubocicloide/dude@0.6.1

## 5.0.0

### Minor Changes

- 77a06b3: Add YAML frontmatter to .claude agents and skills; migrate rules from applyTo to paths key
- cdff3ea: feat: optional PostgreSQL (SQLModel + Alembic), Celery worker and Celery Beat support

  `dude init` now asks three extra questions:
  - **Database** — `none` (default) or `postgres`
  - **Add Celery worker?** — boolean
  - **Add Celery Beat?** — boolean (auto-enables Celery)

  Selecting postgres scaffolds: `alembic.ini`, `alembic/env.py`, `start.sh` (waits for Postgres, runs migrations), `app/core/database.py`, `User` model + `UserQueries` class + `GET /api/users/` router, and conditional `docker-compose.yml` services (`postgres` with healthcheck, `alembic` volume mounts).

  Selecting Celery adds: `app/worker.py`, `app/tasks/example.py`, Flower monitor in compose.

  Selecting Celery Beat adds: `app/tasks/scheduled.py` with a periodic `heartbeat` task.

  New `dude db` commands: `makemigration`, `migrate`, `rollback` — run Alembic inside the backend container.

- 77a06b3: Add non-interactive `make changeset-add` target and update release skill docs

### Patch Changes

- Updated dependencies [77a06b3]
- Updated dependencies [cdff3ea]
- Updated dependencies [77a06b3]
  - @cubocicloide/dude@0.6.0

## Unreleased

### Minor Changes

- **tasks/ is now a required backend directory**: `backend/app/tasks/` and
  `backend/app/tests/tasks/` are part of the required structure enforced by
  lint checks BE001 and BE008.
- `template/backend/app/tasks/__init__.py` and
  `template/backend/app/tests/tasks/__init__.py` added to the base scaffold.
- Celery overlay now includes `tests/tasks/test_example.py`; CeleryBeat overlay
  includes `tests/tasks/test_scheduled.py`.
- `.claude/rules/BE/001.md` and `008.md` updated to reflect the new structure.

## 4.0.0

### Patch Changes

- Updated dependencies [c86b0d0]
  - @cubocicloide/dude@0.5.0

## 3.0.0

### Patch Changes

- Updated dependencies [3d0a4d1]
  - @cubocicloide/dude@0.4.0

## 2.0.0

### Minor Changes

- 7305179: feat: generated project includes pinned package.json + .npmrc — `dude init` now writes a root `package.json` with `@cubocicloide/dude` pinned to the exact version used at init time, and a `.npmrc` ready for GitHub Packages auth

### Patch Changes

- Updated dependencies [7305179]
  - @cubocicloide/dude@0.3.0

## 1.0.0

### Minor Changes

- b786a3d: feat: add `dude version` command, simplify init to single `dude.json`, add hooks/utils/assets to frontend template, add FE008 lint check, simplify Docker dev setup with HMR volumes

### Patch Changes

- Updated dependencies [b786a3d]
  - @cubocicloide/dude@0.2.0
