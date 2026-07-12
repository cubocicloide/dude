// Desk form script — client-side view logic for Ticket Escalation Rule.
// Runs in the browser when the form is opened in the Desk UI.
// Reference: https://docs.frappe.io/framework/user/en/api/form
frappe.ui.form.on("Ticket Escalation Rule", {
	refresh(frm) {
		if (!frm.doc.is_enabled) {
			frm.dashboard.set_headline(__("This rule is disabled and will never fire."));
		}
		if (frm.doc.workflow_state && frm.doc.workflow_state !== "Approved") {
			frm.dashboard.set_headline(
				__("Awaiting approval — only <b>Approved</b> rules escalate tickets."),
			);
		}
	},

	hours_until_escalation(frm) {
		// Field-change handler: gentle client-side guardrail (the controller
		// enforces the same rule server-side — never trust the client alone).
		if (frm.doc.hours_until_escalation < 1) {
			frappe.msgprint(__("Hours Until Escalation must be at least 1."));
		}
	},
});
