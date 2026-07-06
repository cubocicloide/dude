"""### example_batch_compute — the compute-intensive pattern (AWS Batch, simulated)

Some steps don't fit a Fargate task: hours of CPU, hundreds of GB of RAM,
GPUs, or thousands of parallel jobs. The right tool is **AWS Batch** — Airflow
submits a job and waits; Batch owns queueing, retries at the compute layer and
scale-to-zero. Airflow stays a thin orchestrator: no data, no compute inside
the worker.

This DAG makes the pattern tangible WITHOUT provisioning Batch:

* by default (`simulate=true`, or whenever BATCH_JOB_QUEUE is unset) it runs a
  **simulation**: the workload is split into chunks, dynamic task mapping fans
  one mapped task out per chunk (watch the Grid view), then an aggregate step
  reduces the partial results — exactly the submit → fan-out → reduce shape a
  real Batch array job has;
* trigger it with `{"simulate": false}` after wiring BATCH_JOB_QUEUE /
  BATCH_JOB_DEFINITION (see docs) and the same DAG submits a real
  `BatchOperator` job instead — the orchestration shape does not change.
"""

import os

import pendulum
from airflow.providers.amazon.aws.operators.batch import BatchOperator
from airflow.sdk import DAG, task

from lib.defaults import DEFAULT_ARGS

# Plain env vars, injected by the IaC when Batch exists (parse-safe — AF006).
BATCH_JOB_QUEUE = os.getenv("BATCH_JOB_QUEUE", "")
BATCH_JOB_DEFINITION = os.getenv("BATCH_JOB_DEFINITION", "")

CHUNKS = 8  # how many partitions the simulated workload is split into

with DAG(
    dag_id="example_batch_compute",
    description="Compute-intensive workload via AWS Batch (simulated by default).",
    schedule=None,  # on-demand
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    tags=["examples", "containers", "aws", "compute"],
    default_args=DEFAULT_ARGS,
    params={"simulate": True},
    doc_md=__doc__,
):

    @task.branch
    def choose_mode(params: dict | None = None) -> str:
        """Real Batch only when explicitly requested AND the infra is wired."""
        simulate = True if params is None else bool(params.get("simulate", True))
        if not simulate and BATCH_JOB_QUEUE and BATCH_JOB_DEFINITION:
            return "submit_batch_job"
        return "plan_chunks"

    # ── Simulated path: submit → fan-out per chunk → reduce ─────────────────

    @task
    def plan_chunks() -> list[int]:
        """Stand-in for 'split the input dataset into independent partitions'."""
        return list(range(CHUNKS))

    @task
    def process_chunk(chunk: int) -> int:
        """One partition of the heavy computation.

        In the real setup this body IS the Batch container: each mapped task
        here corresponds to one index of a Batch array job. Keep it pure —
        read a partition, compute, write a partial result.
        """
        result = sum(i * i for i in range(100_000 * (chunk + 1)))
        print(f"chunk {chunk}: partial={result}")
        return result % 1_000_000

    @task
    def aggregate(partials: list[int]) -> int:
        """Reduce step — combines the partial results."""
        total = sum(partials)
        print(f"aggregated {len(partials)} chunks: total={total}")
        return total

    # ── Real path: hand the whole computation to AWS Batch ──────────────────

    submit_batch_job = BatchOperator(
        task_id="submit_batch_job",
        job_name="example-batch-compute",
        job_queue=BATCH_JOB_QUEUE,
        job_definition=BATCH_JOB_DEFINITION,
        # Array job = the managed version of the fan-out simulated above.
        array_properties={"size": CHUNKS},
        deferrable=True,  # free the worker slot while Batch crunches
    )

    @task(trigger_rule="none_failed_min_one_success")
    def done() -> None:
        print("workload complete (simulated or Batch).")

    mode = choose_mode()
    chunks = plan_chunks()
    partials = process_chunk.expand(chunk=chunks)
    total = aggregate(partials)

    mode >> chunks
    mode >> submit_batch_job
    [total, submit_batch_job] >> done()
