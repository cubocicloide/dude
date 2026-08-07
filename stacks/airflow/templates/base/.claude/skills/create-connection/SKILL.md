---
name: create-connection
description: Add an Airflow connection or variable to this project. Asks what the DAGs need and whether the value is secret, surveys what is already wired, then configures it the project's way — AIRFLOW_CONN_*/AIRFLOW_VAR_* env vars through docker-compose and .env.example locally, terraform app_environment or dude iac secrets in AWS — and verifies with dude lint and the Airflow CLI.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(docker *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *) Bash(test *)"
---

# Create Connection (or Variable)

Guided wiring of an Airflow **Connection** (credentials + coordinates for an
external system, referenced by `conn_id`) or **Variable** (a named runtime
value) into this project, without inventing a mechanism the deployment does not
have.

> Relevant rules: `.claude/rules/AF/006.md` (never look a connection or
> variable up at parse time) and `.claude/rules/AF/010.md` (`.env.example` is
> the contract for every variable the deployment consumes). `dude explain
> AF010` prints the page.

---

## Step 0 — Locate the project and detect the targets

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

```bash
test -d "$PROJECT_ROOT/iac" && echo "iac: aws-ecs" || echo "iac: none"
```

`iac: none` means this project was scaffolded without `--iac aws-ecs` — there
is no AWS target, so **skip Step 5** and configure the local deployment only.

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **Connection or Variable?**
   - *Connection* — anything a hook/operator talks to: a database, an S3
     bucket, an HTTP API, a Kubernetes cluster. Identified by a `conn_id`.
   - *Variable* — a bare value a DAG reads at runtime (a bucket name, a
     threshold, a feature flag).
2. **Name** — the `conn_id` (e.g. `warehouse_postgres`) or variable name
   (e.g. `target_bucket`). Lowercase snake_case; it becomes an env var name in
   upper case, so it must match `[a-z][a-z0-9_]*`.
3. **Connection type + fields** (connections only) — `postgres`, `aws`, `http`,
   `kubernetes`, … plus host, port, login, password, schema and any `extra`.
4. **Is the value secret?** Credentials and tokens are; a bucket name or a
   region is not. This decides the mechanism in Step 3.
5. **Which environments** — local only, AWS only, or both (they are configured
   separately, Steps 4 and 5).
6. **Which DAG consumes it** — so Step 6 can wire the read correctly.

---

## Step 2 — Survey what is already wired (reuse before create)

```bash
grep -rn "conn_id" "$PROJECT_ROOT"/airflow/dags "$PROJECT_ROOT"/airflow/plugins
grep -rn "Variable.get\|var\.value\." "$PROJECT_ROOT"/airflow/dags "$PROJECT_ROOT"/airflow/plugins
grep -n "AIRFLOW_CONN_\|AIRFLOW_VAR_" "$PROJECT_ROOT"/docker-compose.yml "$PROJECT_ROOT"/.env.example
sed -n '/x-airflow-common/,/^services:/p' "$PROJECT_ROOT"/docker-compose.yml
```

And, when `iac: aws-ecs`:

```bash
grep -n "AIRFLOW_CONN_\|AIRFLOW_VAR_\|app_environment\|app_secret_keys" "$PROJECT_ROOT"/iac/terraform/ecs.tf
cat "$PROJECT_ROOT"/iac/terraform/environments/*/terraform.tfvars
```

- **Reuse an existing connection** before adding one — `aws_default` already
  exists in the AWS deployment (`AIRFLOW_CONN_AWS_DEFAULT=aws://`, resolving to
  the ECS task role), and `example_kubernetes_pod.py` expects the conventional
  `kubernetes_default`.
- If a DAG already reads the value under a different name, rename rather than
  add a second source of truth.

Report what you found and what you intend to reuse.

---

## Step 3 — Choose the mechanism

Airflow resolves connections and variables from environment variables **before**
the metadata database, using a fixed naming convention:

| What | Env var | Value |
|------|---------|-------|
| Connection | `AIRFLOW_CONN_<CONN_ID IN UPPER CASE>` | a connection URI (`postgresql://user:pass@host:5432/db`) or a JSON object (`{"conn_type": "aws", "extra": {...}}`) |
| Variable | `AIRFLOW_VAR_<NAME IN UPPER CASE>` | the plain value |

That is what the IaC already uses (`AIRFLOW_CONN_AWS_DEFAULT`,
`AIRFLOW_VAR_ECS_LOG_GROUP` in `iac/terraform/ecs.tf`), and it is the mechanism
to prefer: it is in version control, identical in every environment, and needs
no manual step on a fresh machine.

| Situation | Mechanism |
|-----------|-----------|
| Non-secret, needed everywhere | env var — Step 4 (local) and Step 5 (AWS) |
| Secret, local development | env var whose value lives in `.env` (gitignored) — Step 4 |
| Secret, AWS | `dude iac secrets` + `app_secret_keys` — Step 5 |
| A human's personal credential, or an exploratory one-off | Airflow UI, Admin → Connections / Variables (Step 4, alternative) |

Env-var-backed connections and variables are resolved at runtime but are **not
listed** in the UI's Admin screens — that is expected, not a bug. Verify them
with the CLI (Step 7).

---

## Step 4 — Configure the local deployment

Compose passes only the variables it names explicitly, so a new value needs
**three** edits. Take the shared `x-airflow-common` `environment:` block —
every component (api-server, scheduler, dag-processor, triggerer, airflow-cli)
inherits it.

**1. `docker-compose.yml`** — add the interpolation to `x-airflow-common` →
`environment:`, next to the existing keys:

```yaml
x-airflow-common: &airflow-common
  environment: &airflow-common-env
    ...
    AIRFLOW_CONN_WAREHOUSE_POSTGRES: ${AIRFLOW_CONN_WAREHOUSE_POSTGRES:-}
    AIRFLOW_VAR_TARGET_BUCKET: ${AIRFLOW_VAR_TARGET_BUCKET:-}
```

**2. `.env.example`** — document it (AF010 makes an undocumented `${VAR}` an
**error**). Never put a real secret here: a safe local default, or `CHANGE-ME`
plus a comment saying where the real value comes from.

```bash
# Warehouse connection used by the sales DAGs. Local default points at the
# bundled postgres; the real DSN comes from the platform team.
AIRFLOW_CONN_WAREHOUSE_POSTGRES=postgresql://airflow:airflow@postgres:5432/airflow
# Destination bucket for daily_sales_rollup.
AIRFLOW_VAR_TARGET_BUCKET=local-dev-bucket
```

**3. `.env`** — the real local value. `.env` is gitignored; never commit it.

Then recreate the containers so they pick up the new environment (an env change
is not applied by a plain restart):

```bash
cd "$PROJECT_ROOT" && dude down && dude up
```

**Alternative — the UI.** For a credential that should not sit in any file on
the machine, add it at http://localhost:8080 → Admin → Connections / Variables.
It is stored in the metadata DB, encrypted with `AIRFLOW_FERNET_KEY`: set a
stable key in `.env` first (the generation command is in the `.env.example`
comment), otherwise the entry does not survive a key change. This route is
per-machine and not reproducible — do not use it for anything a teammate or CI
also needs.

---

## Step 5 — Configure AWS (only when `iac/` exists)

Two paths, decided by whether the value is secret.

**Non-secret** — add it to `app_environment` in the environment's tfvars; it is
injected into every container as a plain env var:

```hcl
# iac/terraform/environments/dev/terraform.tfvars
app_environment = {
  AIRFLOW_VAR_TARGET_BUCKET = "acme-prod-exports"
}
```

```bash
dude iac plan --env dev && dude iac apply --env dev
```

**Secret** — the value goes into the environment's Secrets Manager secret, and
the key is wired into the task definitions by Terraform:

```bash
dude iac secrets --env dev --set AIRFLOW_CONN_WAREHOUSE_POSTGRES='postgresql://user:pass@host:5432/db'
```

```hcl
# iac/terraform/environments/dev/terraform.tfvars
app_secret_keys = ["AIRFLOW_CONN_WAREHOUSE_POSTGRES"]
```

```bash
dude iac apply --env dev          # wires the key into the task definitions
```

Changing the **value** of an already-wired key needs no apply — just re-set it
and recycle the running containers:

```bash
dude iac secrets --env dev --set AIRFLOW_CONN_WAREHOUSE_POSTGRES='…' --roll
dude iac secrets --env dev        # list the keys (add --reveal for values)
```

Repeat per environment — each has its own tfvars and its own secret.

---

## Step 6 — Consume it from a DAG (AF006)

The dag-processor re-imports every DAG file continuously, so a lookup at module
scope or in the `with DAG(...)` body hits the database or secrets backend on
every parse cycle. Both correct forms:

```python
@task
def load() -> None:
    from airflow.sdk import Variable

    bucket = Variable.get("target_bucket")          # runtime — AF006-safe
    ...

@task
def query() -> None:
    from airflow.hooks.base import BaseHook

    conn = BaseHook.get_connection("warehouse_postgres")
    ...
```

```python
# Or let Jinja resolve it at task runtime, in any templated field:
BashOperator(
    task_id="sync",
    bash_command="aws s3 sync /data s3://{{ var.value.target_bucket }}/",
)
```

Most provider operators and hooks take the `conn_id` directly — prefer that
over resolving the connection by hand:

```python
SQLExecuteQueryOperator(task_id="rollup", conn_id="warehouse_postgres", sql="…")
KubernetesPodOperator(task_id="run_pod", kubernetes_conn_id="kubernetes_default", …)
```

`example_kubernetes_pod.py` shows the second form, including the
`@task.short_circuit` guard that keeps the DAG green when the connection is
absent — worth copying for any DAG whose external system is optional locally.

A plain `os.getenv("MY_FLAG")` at module scope is fine (it touches no
database), but it is still a variable the deployment consumes, so it must
appear in `.env.example` too (AF010, warning).

---

## Step 7 — Validate

```bash
cd "$PROJECT_ROOT"
dude lint --format json     # AF010 must be clean: every ${VAR} documented
dude test                   # DAG integrity suite still green
```

For any reported code, run `dude explain <CODE>` and fix the cause.

With the deployment running (`dude up`), confirm Airflow actually resolves it:

```bash
dude shell --service airflow-apiserver
# inside the container:
airflow connections get warehouse_postgres
airflow variables get target_bucket
exit
```

Then check nothing broke at parse time and exercise the consuming DAG:

```bash
dude dag errors                     # must be empty
dude dag test --id <dag_id>         # runs the tasks for real
```

In AWS, the equivalent check is `dude iac status --env dev` after the apply or
`--roll`, then the DAG's task log.

---

## Step 8 — Report

```
Connection/Variable wired
═════════════════════════════════════════
Kind        <connection | variable>
Name        <conn_id | variable name>
Env var     AIRFLOW_CONN_<…> | AIRFLOW_VAR_<…>
Secret      <yes | no>
Local       docker-compose.yml + .env.example (+ .env, not committed)
AWS         <app_environment (tfvars) | dude iac secrets + app_secret_keys | n/a>
Consumed by <dag_id> → <task_id>
─────────────────────────────────────────
dude lint:              ✓  (0 errors)
airflow connections get: ✓ / not run (deployment down)
dude dag errors:        ✓
Remaining manual step: set the real value in .env (and `dude iac apply --env <env>`)
```
