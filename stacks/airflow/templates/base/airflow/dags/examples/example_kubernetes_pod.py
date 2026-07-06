"""### example_kubernetes_pod — run a container in a dedicated Kubernetes pod

The Kubernetes twin of `example_ecs_task`: `KubernetesPodOperator` launches
an arbitrary image in **its own pod** on any cluster Airflow can reach, waits
for it, and streams its logs into the task log. Use it when your platform is
EKS/AKS/on-prem Kubernetes rather than ECS.

Prerequisite: an Airflow *connection* named `kubernetes_default` pointing at
the target cluster (Admin → Connections, type "Kubernetes"; in-cluster config
when Airflow itself runs on Kubernetes). Without it the guard task
short-circuits, so the DAG stays green locally.
"""

import pendulum
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from airflow.sdk import DAG, task
from kubernetes.client import models as k8s

from lib.defaults import DEFAULT_ARGS

K8S_CONN_ID = "kubernetes_default"

with DAG(
    dag_id="example_kubernetes_pod",
    description="Run a container in a dedicated Kubernetes pod.",
    schedule=None,  # on-demand
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    tags=["examples", "containers", "kubernetes"],
    default_args=DEFAULT_ARGS,
    doc_md=__doc__,
):

    @task.short_circuit
    def k8s_configured() -> bool:
        """Skip (successfully) unless a kubernetes_default connection exists."""
        from airflow.hooks.base import BaseHook

        try:
            BaseHook.get_connection(K8S_CONN_ID)  # runtime lookup — AF006-safe
            return True
        except Exception:
            print(f"No '{K8S_CONN_ID}' connection — skipping (add one to enable).")
            return False

    run_pod = KubernetesPodOperator(
        task_id="run_pod",
        kubernetes_conn_id=K8S_CONN_ID,
        namespace="default",
        name="example-pod",
        image="python:3.12-slim",
        cmds=["python", "-c"],
        arguments=["print('hello from a dedicated pod')"],
        # Pod hygiene: always clean up, cap resources explicitly.
        on_finish_action="delete_pod",
        container_resources=k8s.V1ResourceRequirements(
            requests={"cpu": "250m", "memory": "256Mi"},
            limits={"cpu": "500m", "memory": "512Mi"},
        ),
        get_logs=True,
    )

    k8s_configured() >> run_pod
