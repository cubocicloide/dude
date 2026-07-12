"""Controller for the Ticket Escalation Rule DocType.

The class name is the CamelCase DocType name; Frappe instantiates it for
every document of this type. Lifecycle hooks you can override include
validate, before_save, on_update, on_trash — see
https://docs.frappe.io/framework/user/en/basics/doctypes/controllers
"""

import frappe
from frappe import _
from frappe.model.document import Document


class TicketEscalationRule(Document):
	def validate(self):
		"""Runs on every save, before the document hits the database."""
		if self.hours_until_escalation is not None and self.hours_until_escalation <= 0:
			frappe.throw(_("Hours Until Escalation must be a positive number."))
