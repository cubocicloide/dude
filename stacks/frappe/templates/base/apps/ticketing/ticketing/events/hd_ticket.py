"""doc_events handlers for Helpdesk's HD Ticket (see hooks.py).

Each handler is a plain function taking (doc, method). `doc` is the HD Ticket
document being saved; `method` is the event name. This is the canonical way
to extend a DocType owned by another app without forking it.
"""

import frappe


def after_insert(doc, method=None) -> None:
	"""Welcome-stamp new tickets so agents see the intake time at a glance."""
	doc.add_comment(
		"Comment",
		"Ticket received — the ticketing app is watching this ticket "
		"(auto-escalation is active for approved rules).",
	)


def on_update(doc, method=None) -> None:
	"""Log status transitions to the Frappe log for observability.

	`doc.get_doc_before_save()` returns the previous version of the document
	within the same save cycle — the standard way to detect field changes.
	"""
	before = doc.get_doc_before_save()
	if before is None or before.status == doc.status:
		return

	frappe.logger("ticketing").info(
		f"HD Ticket {doc.name}: status {before.status} -> {doc.status}"
	)
