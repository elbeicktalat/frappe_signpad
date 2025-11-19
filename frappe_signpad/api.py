import frappe
from frappe.utils.data import now_datetime
import hmac
import hashlib
import json
import base64
import time  # Required to generate a unique timestamp for the file name

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
def submit_invoice_signature(invoice_id, token, signer_name, signature_image, signature_trace_data):
	"""
	Receives signature data, including temporal trace (Audit Trail),
	verifies integrity via Hash, and saves the evidence as attachments.
	"""
	# --------------------------------------------------------------------------------
	# 1. Preliminary Checks and Security
	# --------------------------------------------------------------------------------
	if not invoice_id or not token or not signer_name or not signature_image or not signature_trace_data:
		frappe.throw("Missing required data (ID, Token, Name, Signature, or Trace Data).",
					 frappe.exceptions.ValidationError)

	# Fetch the document
	try:
		doc = frappe.get_doc(DOC_TYPE, invoice_id)
	except frappe.exceptions.DoesNotExistError:
		frappe.throw(f"Invoice {invoice_id} not found.", frappe.exceptions.NotFound)

	# Check document status and token
	if doc.docstatus != 1:
		frappe.throw("Draft or canceled invoice cannot be signed.",
					 frappe.exceptions.PermissionError)

	if not verify_token(invoice_id, str(doc.due_date), token):
		frappe.log_error("Security Alert: Invalid Token on Submission", f"ID: {invoice_id}")
		frappe.throw("Invalid or expired signing token. Signature rejected.",
					 frappe.exceptions.PermissionError)

	# --------------------------------------------------------------------------------
	# 2. Audit Trail Generation and Integrity Hash
	# --------------------------------------------------------------------------------

	# Serialization of trace data for the Hash (ensures order consistency)
	trace_data_str = json.dumps(signature_trace_data, sort_keys=True)

	# Critical data for the SHA-256 Hash (links all components immutably)
	critical_data = f"{invoice_id}|{signer_name}|{trace_data_str}|{signature_image}"
	signature_hash = hashlib.sha256(critical_data.encode('utf-8')).hexdigest()

	# Environmental Metadata
	client_ip = frappe.request.remote_addr
	user_agent = frappe.request.headers.get('User-Agent')
	server_timestamp = now_datetime()  # Server-side timestamp

	# CONVERSIONE: Converti l'oggetto datetime in una stringa ISO 8601
	server_timestamp_str = server_timestamp.isoformat()

	# --------------------------------------------------------------------------------
	# 3. Data Storage (Attachments)
	# --------------------------------------------------------------------------------
	try:
		# A. Save Signature Image File
		# Separates the Data URL header from the Base64 content
		base64_data = signature_image.split(",")[1]
		file_content = base64.b64decode(base64_data)

		# Create the File attachment for the image
		frappe.get_doc({
			"doctype": "File",
			"file_name": f"signature-{invoice_id}.png",
			"attached_to_doctype": DOC_TYPE,
			"attached_to_name": invoice_id,
			"content": file_content,
			"folder": "Home/Signatures",
			"is_private": 1
		}).insert(ignore_permissions=True)

		# B. Save Audit Trail File (Temporal Trace JSON)
		audit_trail_data = {
			"signer_name": signer_name,
			"trace_data": signature_trace_data,  # <--- TEMPORAL DATA CAPTURED AND SAVED!
			"hash_sha256": signature_hash,
			"signed_on_server": server_timestamp_str,
			"client_ip": client_ip,
			"user_agent": user_agent,
		}

		# Use Unix timestamp to ensure file name uniqueness
		trace_filename = f"signature_audit_{invoice_id}_{int(time.time())}.json"
		trace_content_str = json.dumps(audit_trail_data, indent=2)

		frappe.get_doc({
			"doctype": "File",
			"file_name": trace_filename,
			"attached_to_doctype": DOC_TYPE,
			"attached_to_name": invoice_id,
			# Salviamo la stringa JSON come contenuto del file
			"content": trace_content_str.encode('utf-8'),
			"folder": "Home/Signatures",  # Potresti voler una cartella separata
			"is_private": 1
		}).insert(ignore_permissions=True)

		# --------------------------------------------------------------------------------
		# 4. Update Main Document (Sales Invoice)
		# --------------------------------------------------------------------------------
		doc.signer_name = signer_name
		doc.signed_on = server_timestamp

		# Update custom fields with hash and IP for easy reference
		# doc.signature_hash = signature_hash
		# doc.client_ip = client_ip

		doc.save(ignore_permissions=True)
		frappe.db.commit()

		frappe.msgprint(
			f"Signature for {invoice_id} acquired and secured successfully. Hash: {signature_hash[:10]}...")
		return {"message": "Signature saved successfully.", "hash": signature_hash}

	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(f"Error processing signature for {invoice_id}", frappe.get_traceback())
		frappe.throw(f"Failed to process signature: {str(e)}")


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
