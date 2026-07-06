"""Sanity checks for the project's plugins (ops_toolkit as shipped)."""

from datetime import datetime


def test_plugin_registers_airflow_plugin():
    import ops_toolkit

    from airflow.plugins_manager import AirflowPlugin

    assert issubclass(ops_toolkit.OpsToolkitPlugin, AirflowPlugin)
    assert ops_toolkit.OpsToolkitPlugin.name == "ops_toolkit"


def test_business_days_macro():
    from ops_toolkit.macros import ds_add_business_days

    # 2026-01-02 is a Friday: +1 business day lands on Monday the 5th.
    assert ds_add_business_days("2026-01-02", 1) == "2026-01-05"
    assert ds_add_business_days("2026-01-05", -1) == "2026-01-02"


def test_workday_timetable_skips_weekends():
    from pendulum import UTC, DateTime

    from airflow.timetables.base import DataInterval, TimeRestriction
    from ops_toolkit.timetables import WorkdayTimetable

    tt = WorkdayTimetable()
    # Last automated interval covered Friday 2026-01-02 → next run covers Monday.
    friday = DateTime(2026, 1, 2, tzinfo=UTC)
    info = tt.next_dagrun_info(
        last_automated_data_interval=DataInterval(start=friday, end=friday.add(days=1)),
        restriction=TimeRestriction(earliest=DateTime(2026, 1, 1, tzinfo=UTC), latest=None, catchup=True),
    )
    assert info is not None
    assert info.data_interval.start.weekday() == 0  # Monday
    assert datetime.strftime(info.data_interval.start, "%Y-%m-%d") == "2026-01-05"
