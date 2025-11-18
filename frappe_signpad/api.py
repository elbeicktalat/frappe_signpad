import frappe
from frappe.utils.data import now_datetime
import hmac
import hashlib
import json
import base64
from datetime import datetime

# IMPORTANT: Store this in a secure config/settings file, NOT directly in the code!
# For demonstration, it's here.
SECRET_KEY = frappe.get_site_config().get("invoice_signing_secret_key", "A_VERY_LONG_AND_SECURE_RANDOM_STRING_HERE")
DOC_TYPE = "Sales Invoice"

def generate_token(invoice_id, due_date):
	"""Generates an HMAC-SHA256 token based on the invoice data and secret key."""
	# Data to sign: Invoice ID + Due Date (ensuring data integrity/relevance)
	data = f"{invoice_id}|{due_date}"

	# Use the frappe SECRET_KEY to sign the data
	signature = hmac.new(
		SECRET_KEY.encode('utf-8'),
		data.encode('utf-8'),
		hashlib.sha256
	).hexdigest()

	return signature

def verify_token(invoice_id, expected_due_date, client_token):
	"""Verifies the token sent by the client."""
	# 1. Recalculate the expected token
	expected_token = generate_token(invoice_id, expected_due_date)

	# 2. Compare using constant-time comparison to prevent timing attacks
	return hmac.compare_digest(expected_token, client_token)

# --- PUBLIC API METHODS ---

@frappe.whitelist(allow_guest=True)
def get_invoice_data_securely(invoice_id, token):
	"""
Securely fetches invoice details after verifying the token.
This replaces the vulnerable direct API call on the frontend.
	"""
	if not invoice_id or not token:
		frappe.throw("Missing invoice ID or security token.", frappe.exceptions.ValidationError)

	# 1. Fetch the necessary document details
	try:
		doc = frappe.get_doc(DOC_TYPE, invoice_id)
	except frappe.exceptions.DoesNotExistError:
		frappe.throw(f"Invoice {invoice_id} not found.", frappe.exceptions.NotFound)

	# Check if invoice is already signed/submitted
	if doc.docstatus != 1: # Assuming status 1 is Submit/Unsigned
		frappe.throw("Invoice is not in a signable state or is already signed.", frappe.exceptions.PermissionError)

	# 2. Verify the token using the actual due_date from the document
	if not verify_token(invoice_id, str(doc.due_date), token):
		# SECURITY ALERT: Log this attempt for intrusion detection!
		frappe.log_error(
			"Security Alert: Invalid Token Attempt",
			f"ID: {invoice_id}, Client Token: {token[:10]}..."
		)
		# Return a 403 error for a security failure
		frappe.throw("Invalid or expired signing token.", frappe.exceptions.PermissionError)

	# 3. If valid, return only the necessary presentation data
	return {
		"name": doc.name,
		"total_qty": doc.total_qty,
		"grand_total": doc.grand_total,
		"due_date": str(doc.due_date),
		"currency": doc.currency,
		"is_signed": doc.signer_name or doc.signed_on,
		# Add other relevant fields the frontend needs
	}


@frappe.whitelist(allow_guest=True)
def submit_invoice_signature(invoice_id, token, signer_name, signature_image):
	"""
Processes the signature submission after verifying the token again.
	"""
	if not invoice_id or not token or not signer_name or not signature_image:
		frappe.throw("Missing required data (ID, Token, Name, or Signature).", frappe.exceptions.ValidationError)

	# 1. Fetch the document
	try:
		doc = frappe.get_doc(DOC_TYPE, invoice_id)
	except frappe.exceptions.DoesNotExistError:
		frappe.throw(f"Invoice {invoice_id} not found.", frappe.exceptions.NotFound)

	# Check if invoice is already signed/submitted
	if doc.docstatus != 1:
		frappe.throw("Invoice is already submitted or canceled.", frappe.exceptions.PermissionError)

	# 2. DOUBLE CHECK: Verify the token again before saving/submitting
	if not verify_token(invoice_id, str(doc.due_date), token):
		frappe.log_error("Security Alert: Invalid Token on Submission", f"ID: {invoice_id}")
		frappe.throw("Invalid or expired signing token. Signature rejected.", frappe.exceptions.PermissionError)

	# 3. Process and save the signature image
	try:
		# Frappe requires base64 string without data prefix
		# Example: 'data:image/png;base64,iVBORw0KGgoAAA...' -> 'iVBORw0KGgoAAA...'
		base64_data = signature_image.split(",")[1]
		file_content = base64.b64decode(base64_data)

		# Create a Frappe File attachment for the signature
		file_doc = frappe.get_doc({
			"doctype": "File",
			"file_name": f"signature-{invoice_id}.png",
			"attached_to_doctype": DOC_TYPE,
			"attached_to_name": invoice_id,
			"content": file_content,
			"folder": "Home/Signatures",
			"is_private": 1 # Keep signature private
		})
		file_doc.insert(ignore_permissions=True)
		frappe.db.commit()

		# 4. Update the Invoice document with signer name and signature link
		doc.db_set("signer_name", signer_name) # Ensure these custom fields exist on Sales Invoice
		# doc.db_set("signature_file", file_doc.file_url)

		# Optional: Set a flag indicating it was signed digitally
		# doc.db_set("is_signed_digitally", 1)
		doc.db_set("signed_on", now_datetime())

		# Final action: Change the document status or process the next step
		# E.g., You might move it to a "Confirmed" status, or submit it if docstatus was 0

		frappe.db.commit()

		frappe.msgprint(f"Signature for {invoice_id} acquired successfully.")

	except Exception as e:
		frappe.log_error(f"Error processing signature for {invoice_id}", str(e))
		frappe.throw("Failed to process signature. Please try again.")


# Example function to be called when sending the email to the client
@frappe.whitelist(allow_guest=False)
def get_signing_link(invoice_id):
	"""Helper to generate the secure link (used during email sending)."""
	try:
		doc = frappe.get_doc(DOC_TYPE, invoice_id)
		token = generate_token(invoice_id, str(doc.due_date))
		# This is the link you embed in the email/PDF
		signing_url = f"{frappe.utils.get_url()}/signpad?id={invoice_id}&token={token}"
		return signing_url
	except Exception:
		return f"Error generating link for {invoice_id}"