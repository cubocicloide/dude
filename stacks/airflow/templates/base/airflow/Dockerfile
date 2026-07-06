# Development image — the official Airflow image plus this project's extra
# Python packages. Every component (api-server, scheduler, dag-processor,
# triggerer, CLI) runs from this one image.
#
# Bump the Airflow version HERE (and run `dude up --build`); keep
# requirements.txt pins compatible — for apache-airflow-providers-* packages
# prefer the versions from the matching constraints file:
#   https://raw.githubusercontent.com/apache/airflow/constraints-<AIRFLOW_VERSION>/constraints-3.12.txt
ARG AIRFLOW_VERSION=3.1.0
FROM apache/airflow:${AIRFLOW_VERSION}

# Project packages — pinned in requirements.txt (lint rule AF009).
COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt
