"""WorkdayTimetable — a custom schedule: one run per workday (Mon–Fri).

Timetables answer scheduling questions cron can't express cleanly (trading
calendars, "last workday of month", …). Registering the class in the plugin
makes it usable from any DAG:

    from ops_toolkit.timetables import WorkdayTimetable

    with DAG(..., schedule=WorkdayTimetable(), ...):

Each run covers one workday: the run for Monday's data executes early Tuesday,
Friday's executes early Monday (weekend days are never data intervals).
"""

from pendulum import UTC, Date, DateTime, Time

from airflow.timetables.base import DagRunInfo, DataInterval, TimeRestriction, Timetable


def _next_workday(date: Date) -> Date:
    date = date.add(days=1)
    while date.weekday() >= 5:  # 5, 6 = Sat, Sun
        date = date.add(days=1)
    return date


def _prev_workday(date: Date) -> Date:
    date = date.subtract(days=1)
    while date.weekday() >= 5:
        date = date.subtract(days=1)
    return date


class WorkdayTimetable(Timetable):
    description = "One run per workday (Mon-Fri), covering that day"

    def serialize(self) -> dict:
        return {}

    @classmethod
    def deserialize(cls, value: dict) -> "WorkdayTimetable":
        return cls()

    @property
    def summary(self) -> str:
        return "@workday"

    def infer_manual_data_interval(self, *, run_after: DateTime) -> DataInterval:
        """A manual trigger covers the most recent complete workday."""
        end = run_after.date()
        if end.weekday() >= 5:
            end = _prev_workday(end).add(days=1)
        start = _prev_workday(end)
        return DataInterval(
            start=DateTime.combine(start, Time.min).replace(tzinfo=UTC),
            end=DateTime.combine(end, Time.min).replace(tzinfo=UTC),
        )

    def next_dagrun_info(
        self,
        *,
        last_automated_data_interval: DataInterval | None,
        restriction: TimeRestriction,
    ) -> DagRunInfo | None:
        if restriction.earliest is None:  # no start_date — never schedule
            return None

        if last_automated_data_interval is not None:
            next_start_date = _next_workday(last_automated_data_interval.start.date())
        else:
            candidate = restriction.earliest.date()
            if restriction.catchup is False:
                today = DateTime.now(UTC).date()
                candidate = max(candidate, _prev_workday(today))
            # Land on a workday.
            next_start_date = candidate if candidate.weekday() < 5 else _next_workday(candidate)

        start = DateTime.combine(next_start_date, Time.min).replace(tzinfo=UTC)
        end = DateTime.combine(_next_workday(next_start_date), Time.min).replace(tzinfo=UTC)

        if restriction.latest is not None and start > restriction.latest:
            return None
        return DagRunInfo.interval(start=start, end=end)
