import frappe


def set_signing_link(self, arg):
	sign_url = frappe.call('frappe_signpad.api.get_signing_link', invoice_id=self.name)
	self.sign_url = sign_url
