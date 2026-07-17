# @cubocicloide/stack-airflow

## 2.0.3

### Patch Changes

- Updated dependencies [f8bfe29]
  - @cubocicloide/dude@0.14.0

## 2.0.2

### Patch Changes

- 59902ae: Fix `dude init` failing with `Cannot find package '@cubocicloide/dude'` when a stack is resolved via the cache-install path (fresh machine, no existing workspace/project). `@cubocicloide/dude` is imported unbundled at runtime (`external` in tsup) but had only been declared in `devDependencies` since #78 removed the redundant `peerDependencies` entry — devDependencies are never installed for a package consumed as someone else's dependency, so nothing pulled `@cubocicloide/dude` into `~/.dude/cache/stacks/…/node_modules`. Moved it to a real `dependencies` entry (still `workspace:*`, rewritten to an exact version at publish) instead of `peerDependencies`, so it installs correctly without reintroducing the changesets peer-range major-bump bug.

## 2.0.1

### Patch Changes

- c93f206: Drop the redundant `peerDependencies` on `@cubocicloide/dude` from every stack. It duplicated the `devDependencies` pin and served no functional purpose (scaffolded projects pin `dude` directly; runtime compatibility is enforced by `minDudeVersion`). The `workspace:^` form also triggered a Changesets bug that forced a spurious **major** bump on every stack whenever `dude` was released; with the peer entry gone, a `dude` release no longer re-versions the stacks at all.

## 2.0.0

### Patch Changes

- Updated dependencies [628eb2b]
  - @cubocicloide/dude@0.13.0

## 1.0.0

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

## 0.3.1

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

## 0.3.0

### Minor Changes

- f6e0ea2: feat(airflow): hybrid executors + monitoring overhaul (AWS ECS IaC)

  **Performance — hybrid executors.** The AWS deployment no longer runs every
  Airflow task through the ECS executor (which cost 60–90s of Fargate cold
  start — ENI + image pull — per task, making a trivial 3-task ETL take
  minutes). `AIRFLOW__CORE__EXECUTOR` is now
  `LocalExecutor,<AwsEcsExecutor module path>`: ordinary tasks run in-process
  inside the scheduler container with no cold start; tasks that need an
  isolated/right-sized container opt in with
  `executor=os.getenv("DEDICATED_TASK_EXECUTOR")` (injected by the IaC, empty
  locally). `example_batch_compute.process_chunk` demonstrates the opt-in.
  Size `core_cpu`/`core_memory` for the LocalExecutor load.

  **Fix — `example_ecs_task` failed after a successful container run**: the
  `EcsRunTaskOperator` log fetcher looked for stream `ecs/worker/<id>` while
  the awslogs driver writes `airflow/worker/<id>`; `awslogs_stream_prefix` is
  now `airflow/worker` (prefix must include the container name).

  **Fix — `dude iac logs` broke on AWS CLI v1** (`aws logs tail` is v2-only).
  Reimplemented on `filter-log-events` (portable v1/v2), with `--service
api-server|scheduler|dag-processor|triggerer|worker|migrate`, `--since`,
  `--follow` and cross-poll dedupe.

  **Monitoring.**
  - `dude iac status` now also shows Airflow's own `/api/v2/monitor/health`
    component heartbeats, the last dedicated worker containers with exit codes
    and stop reasons, and the dashboard/UI links.
  - Every environment gets a CloudWatch dashboard (ECS CPU/memory, ALB requests
    - healthy hosts + 5xx, RDS, live "recent errors" Logs Insights widget) —
      `dashboard_url` output. Container Insights enabled on the cluster.
  - Optional email alarms via `alarm_email` in terraform.tfvars: no healthy UI
    task behind the ALB, core CPU saturated, metadata-DB storage low.
  - ECR lifecycle policy: keep the 10 most recent images.

  Existing deployments: `dude upgrade --stack` does not rewrite scaffolded
  files — re-apply the iac/DAG changes manually (see the release notes) or
  diff against a freshly scaffolded project, then `dude iac apply` + `ship`.

## 0.2.0

### Minor Changes

- 952299e: feat: add airflow stack (Apache Airflow 3)

  New stack plugin `@cubocicloide/stack-airflow`:
  - Airflow 3 in Docker Compose (api-server, scheduler, dag-processor,
    triggerer) — one image, user packages via pinned `requirements.txt`
  - Sign-on choice at init (`--sso native|entra-id`): Airflow user DB or
    Microsoft Entra ID OAuth via the FAB auth manager (app-role → Airflow-role
    mapping)
  - Organized DAG/plugin layout enforced by lint rules AF001–AF010 (dag_id ↔
    filename parity, explicit schedule/catchup/tags, shared `lib.defaults`,
    parse-time hygiene, plugin registration, pinned requirements, env-var
    parity with `.env.example`)
  - Example DAGs: TaskFlow ETL, dedicated-container runs via
    `EcsRunTaskOperator` and `KubernetesPodOperator`, and a simulated AWS Batch
    compute-intensive pattern (dynamic task mapping fan-out/reduce, real
    `BatchOperator` array-job path included)
  - Reference plugin `ops_toolkit`: DAG-run listeners, Jinja macros, custom
    `WorkdayTimetable`
  - `dude dag list|errors|trigger|test`, `dude test` (DAG integrity suite in
    the image), `dude format` (uvx ruff)
  - Optional IaC (`--iac aws-ecs`): Terraform for AWS ECS Fargate — ALB +
    api-server, core service, RDS Postgres, S3 remote task logs, Secrets
    Manager (`dude iac secrets`), one-off `dude iac migrate`, and the AWS ECS
    executor (every Airflow task in its own dedicated Fargate container)

  The CLI's `registry.json` now maps the `airflow` stack name to the new
  package.

### Patch Changes

- Updated dependencies [952299e]
  - @cubocicloide/dude@0.11.5
