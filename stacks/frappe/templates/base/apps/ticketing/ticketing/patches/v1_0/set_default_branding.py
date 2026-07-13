"""One-time patch: point default branding at ticketing's placeholder assets.

Runs once per site (bench migrate). Only fills fields that are still empty,
so it never clobbers branding an admin already set through the Desk UI.
"""

import frappe

LOGO = "/assets/ticketing/images/logo.png"
FAVICON = "/assets/ticketing/images/favicon.png"


def execute() -> None:
	if not frappe.db.exists("DocType", "HD Settings"):
		return  # Helpdesk not installed on this site

	settings = frappe.get_single("HD Settings")
	changed = False
	if not settings.brand_logo:
		settings.brand_logo = LOGO
		changed = True
	if not settings.favicon:
		settings.favicon = FAVICON
		changed = True
	if changed:
		settings.save(ignore_permissions=True)
