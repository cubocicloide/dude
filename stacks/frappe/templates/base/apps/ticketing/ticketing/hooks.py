"""App hooks — the contract between this app and the Frappe framework.

Everything the framework needs to know about the app is declared here:
which events to call us on, which background jobs to schedule, which
records (fixtures) to ship. Keep this file declarative — put the actual
logic in dedicated modules (events/, tasks.py, api.py).
"""

app_name = "ticketing"
app_title = "Ticketing"
app_publisher = "Your Team"
app_description = "Custom ticketing extensions for Frappe Helpdesk — example app"
app_email = "dev@example.com"
app_license = "mit"

# Document events — run code when documents of *any* app change. This is how
# you extend Frappe Helpdesk without forking it: HD Ticket belongs to the
# helpdesk app, the handlers live here. Handlers are dotted paths to plain
# functions taking (doc, method).
doc_events = {
	"HD Ticket": {
		"after_insert": "ticketing.events.hd_ticket.after_insert",
		"on_update": "ticketing.events.hd_ticket.on_update",
	},
}

# Scheduler events — background jobs executed by the `schedule` process.
# Frequencies: all | hourly | daily | weekly | monthly | cron.
scheduler_events = {
	"hourly": [
		"ticketing.tasks.escalate_overdue_tickets",
	],
	"daily": [
		"ticketing.tasks.close_stale_resolved_tickets",
	],
}

# Fixtures — records exported to ticketing/fixtures/*.json and re-imported on
# every `bench migrate`. Order matters: linked masters first.
fixtures = [
	{"dt": "Workflow State", "filters": [["name", "in", ["Draft", "Approved", "Rejected"]]]},
	{"dt": "Workflow Action Master", "filters": [["name", "in", ["Approve", "Reject"]]]},
	{"dt": "Workflow", "filters": [["name", "in", ["Ticket Escalation Rule Approval"]]]},
]
