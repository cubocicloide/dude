"""Shared, DAG-free helper package.

Anything importable by several DAGs lives here (`from lib.x import y` works
because Airflow puts the dags folder on sys.path). Files in lib/ are excluded
from DAG parsing via .airflowignore and must never define DAGs.
"""
