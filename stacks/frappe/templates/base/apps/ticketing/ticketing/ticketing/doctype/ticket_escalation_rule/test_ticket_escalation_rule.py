"""Unit tests for Ticket Escalation Rule.

Run with `dude test` (wraps `bench run-tests --app ticketing`).
FrappeTestCase wraps every test in a transaction and rolls it back,
so tests never leak data into the site.
"""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestTicketEscalationRule(FrappeTestCase):
	def make_rule(self, **overrides):
		doc = frappe.get_doc(
			{
				"doctype": "Ticket Escalation Rule",
				"rule_name": "Test escalation rule",
				"priority": "High",
				"hours_until_escalation": 4,
				**overrides,
			}
		)
		return doc

	def test_valid_rule_is_saved(self):
		rule = self.make_rule().insert()
		self.assertEqual(rule.name, "Test escalation rule")
		self.assertEqual(rule.is_enabled, 1)

	def test_non_positive_hours_are_rejected(self):
		rule = self.make_rule(hours_until_escalation=0)
		self.assertRaises(frappe.ValidationError, rule.insert)
