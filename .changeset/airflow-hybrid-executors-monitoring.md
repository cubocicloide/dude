---
'@cubocicloide/stack-airflow': minor
---

feat(airflow): hybrid executors + monitoring overhaul (AWS ECS IaC)

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
  + healthy hosts + 5xx, RDS, live "recent errors" Logs Insights widget) —
  `dashboard_url` output. Container Insights enabled on the cluster.
- Optional email alarms via `alarm_email` in terraform.tfvars: no healthy UI
  task behind the ALB, core CPU saturated, metadata-DB storage low.
- ECR lifecycle policy: keep the 10 most recent images.

Existing deployments: `dude upgrade --stack` does not rewrite scaffolded
files — re-apply the iac/DAG changes manually (see the release notes) or
diff against a freshly scaffolded project, then `dude iac apply` + `ship`.
