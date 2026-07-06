"""### example_ecs_task — run a container as a dedicated ECS Fargate task

The pattern for "this step needs its own container": package the step as an
image, and have the DAG run it as a **dedicated, right-sized Fargate task**
via `EcsRunTaskOperator`. The Airflow deployment only waits — the heavy
lifting happens in the task's own container with its own CPU/memory.

The scaffold's IaC (`--iac aws-ecs`) provisions everything this DAG needs and
injects the coordinates as environment variables (ECS_CLUSTER,
ECS_WORKER_TASK_DEFINITION, ECS_SUBNETS, ECS_SECURITY_GROUPS). Locally those
are empty, so the guard task short-circuits and the run succeeds as a no-op —
unpause it in AWS to see it for real.

Note: the AWS deployment also ships the **ECS executor** (hybrid with
LocalExecutor) — a task can get a dedicated container just by setting
`executor=os.getenv("DEDICATED_TASK_EXECUTOR")` (see example_batch_compute).
This DAG shows the explicit operator variant, for when the step needs a
different image, task definition or sizing than the standard worker.
"""

import os

import pendulum
from airflow.providers.amazon.aws.operators.ecs import EcsRunTaskOperator
from airflow.sdk import DAG, task

from lib.defaults import DEFAULT_ARGS

# Parse-time reads of plain env vars are fine (no DB/secrets hit — AF006).
ECS_CLUSTER = os.getenv("ECS_CLUSTER", "")
ECS_TASK_DEFINITION = os.getenv("ECS_WORKER_TASK_DEFINITION", "")
ECS_SUBNETS = [s for s in os.getenv("ECS_SUBNETS", "").split(",") if s]
ECS_SECURITY_GROUPS = [s for s in os.getenv("ECS_SECURITY_GROUPS", "").split(",") if s]

with DAG(
    dag_id="example_ecs_task",
    description="Run a container as a dedicated ECS Fargate task.",
    schedule=None,  # on-demand — trigger it from the UI or `dude dag trigger`
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    tags=["examples", "containers", "aws"],
    default_args=DEFAULT_ARGS,
    doc_md=__doc__,
):

    @task.short_circuit
    def ecs_configured() -> bool:
        """Skip the run (successfully) when no ECS infra is wired — e.g. locally."""
        if ECS_CLUSTER and ECS_TASK_DEFINITION and ECS_SUBNETS:
            return True
        print("ECS_* env vars not set — skipping (deploy with `dude iac` to enable).")
        return False

    run_container = EcsRunTaskOperator(
        task_id="run_container",
        cluster=ECS_CLUSTER,
        task_definition=ECS_TASK_DEFINITION,
        launch_type="FARGATE",
        network_configuration={
            "awsvpcConfiguration": {
                "subnets": ECS_SUBNETS,
                "securityGroups": ECS_SECURITY_GROUPS,
                "assignPublicIp": "ENABLED",
            }
        },
        # Override the container command — swap in your own image/task
        # definition for real workloads.
        overrides={
            "containerOverrides": [
                {
                    "name": "worker",
                    "command": ["bash", "-c", "echo 'hello from a dedicated container'"],
                }
            ]
        },
        # Stream the container's CloudWatch logs into the Airflow task log.
        # The stream name the awslogs driver creates is
        # <awslogs-stream-prefix>/<container-name>/<task-id>, so this prefix
        # must be "<log-config prefix>/<container name>" — here airflow/worker.
        awslogs_group="{{ var.value.get('ecs_log_group', '') }}",
        awslogs_stream_prefix="airflow/worker",
    )

    ecs_configured() >> run_container
