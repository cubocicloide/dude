# @cubocicloide/stack-airflow

dude stack plugin for an **Apache Airflow** project:

- **Airflow 3** in Docker Compose (api-server, scheduler, dag-processor,
  triggerer) — one image, extra packages via a pinned `requirements.txt`
- **Organized, lint-enforced layout**: one DAG per file, shared `lib/`
  defaults, plugins as registered packages (`dude lint`, rules AF001–AF010)
- **Sign-on choice at init**: native user DB or **Microsoft Entra ID** OAuth
  (`--sso native|entra-id`), via the FAB auth manager
- **Example DAGs**: TaskFlow ETL, dedicated-container runs on ECS
  (`EcsRunTaskOperator`) and Kubernetes (`KubernetesPodOperator`), and a
  simulated **AWS Batch** compute-intensive pattern (fan-out/reduce with
  dynamic task mapping, real `BatchOperator` path included)
- **Reference plugin** (`ops_toolkit`): DAG-run listeners, Jinja macros and a
  custom `WorkdayTimetable`
- **Optional IaC** (`--iac aws-ecs`): Terraform for AWS ECS Fargate — ALB +
  api-server, core service, RDS Postgres, S3 task logs, Secrets Manager
  (`dude iac secrets`), CloudWatch dashboard + optional email alarms, and
  **hybrid executors** (LocalExecutor by default — no Fargate cold start;
  per-task opt-in to a dedicated container via the AWS ECS executor);
  `dude iac migrate` runs `airflow db migrate` as a one-off task, `dude iac
  status`/`logs` cover day-2 monitoring

## Usage

```bash
dude init --stack airflow my-airflow
dude init --stack airflow --sso entra-id --iac aws-ecs --yes my-airflow
```

See the generated project's `README.md` and `docs/` (via `dude docs`) for the
full guide.
