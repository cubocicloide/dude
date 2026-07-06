---
'@cubocicloide/stack-airflow': minor
'@cubocicloide/dude': patch
---

feat: add airflow stack (Apache Airflow 3)

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
