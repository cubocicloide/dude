"""Whitelisted API methods.

Any function decorated with @frappe.whitelist() becomes an RPC endpoint at
/api/method/<dotted.path>, e.g.:

    GET /api/method/ticketing.api.ticket_stats

Only expose what you must; never add allow_guest=True unless the data is
truly public (see lint rule PY001).
"""

import frappe


@frappe.whitelist()
def ticket_stats() -> dict:
	"""Return HD Ticket counts grouped by status.

	Used by the /ticket-stats portal page; also handy from the browser
	console or any HTTP client authenticated against the site.
	"""
	if not frappe.db.table_exists("HD Ticket"):
		return {"helpdesk_installed": False, "by_status": {}, "total": 0}

	rows = frappe.get_all(
		"HD Ticket",
		fields=["status", "count(name) as total"],
		group_by="status",
	)
	by_status = {row.status: row.total for row in rows}
	return {
		"helpdesk_installed": True,
		"by_status": by_status,
		"total": sum(by_status.values()),
	}
