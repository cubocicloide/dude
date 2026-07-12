"""Background jobs, wired to the scheduler in hooks.py (scheduler_events).

Jobs run in the `schedule` process started by `bench start` (dev) or the
dedicated scheduler service (production). Keep them idempotent: the
scheduler guarantees at-least-once, not exactly-once, execution.
"""

import frappe
from frappe.utils import add_to_date, now_datetime


def escalate_overdue_tickets() -> None:
	"""Hourly: apply enabled, approved Ticket Escalation Rules to open tickets.

	For every ticket older than a rule's threshold, post a comment and
	assign the rule's escalation contact — a deliberately simple example of
	cross-app orchestration driven by a custom DocType.
	"""
	if not frappe.db.table_exists("HD Ticket"):
		return

	rules = frappe.get_all(
		"Ticket Escalation Rule",
		filters={"is_enabled": 1, "workflow_state": "Approved"},
		fields=["name", "priority", "hours_until_escalation", "escalate_to"],
	)

	for rule in rules:
		cutoff = add_to_date(now_datetime(), hours=-rule.hours_until_escalation)
		overdue = frappe.get_all(
			"HD Ticket",
			filters={
				"status": "Open",
				"priority": rule.priority,
				"opening_date": ("<", cutoff),
			},
			pluck="name",
		)
		for ticket_name in overdue:
			_escalate(ticket_name, rule)


def _escalate(ticket_name: str, rule) -> None:
	ticket = frappe.get_doc("HD Ticket", ticket_name)

	marker = f"Escalated by rule {rule.name}"
	already = frappe.db.exists(
		"Comment",
		{
			"reference_doctype": "HD Ticket",
			"reference_name": ticket_name,
			"content": ("like", f"%{marker}%"),
		},
	)
	if already:
		return

	ticket.add_comment(
		"Comment",
		f"{marker}: open for more than {rule.hours_until_escalation}h.",
	)
	if rule.escalate_to:
		_assign(ticket_name, rule.escalate_to)
	frappe.db.commit()


def _assign(ticket_name: str, user: str) -> None:
	from frappe.desk.form.assign_to import add as assign_to

	try:
		assign_to(
			{
				"assign_to": [user],
				"doctype": "HD Ticket",
				"name": ticket_name,
				"description": "Escalated ticket (see comments).",
			}
		)
	except frappe.exceptions.DuplicateEntryError:
		pass  # already assigned — the job re-ran, which is fine


def close_stale_resolved_tickets() -> None:
	"""Daily: close tickets that have sat in Resolved for more than 7 days."""
	if not frappe.db.table_exists("HD Ticket"):
		return

	cutoff = add_to_date(now_datetime(), days=-7)
	stale = frappe.get_all(
		"HD Ticket",
		filters={"status": "Resolved", "modified": ("<", cutoff)},
		pluck="name",
	)
	for ticket_name in stale:
		ticket = frappe.get_doc("HD Ticket", ticket_name)
		ticket.status = "Closed"
		ticket.save(ignore_permissions=True)
	if stale:
		frappe.db.commit()
