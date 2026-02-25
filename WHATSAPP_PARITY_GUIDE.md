# WhatsApp Workflow Parity

This note explains how the WhatsApp automation now mirrors the accountant and project-manager experiences that exist on the web dashboard. The same logic executes through the backend, while n8n keeps a single dynamic HTTP node per role.

## Shared Architecture
- Identity (`/api/webhooks/identity`) resolves the WhatsApp number and role (ACCOUNTANT, PROJECT_MANAGER, etc.).
- Interpreter (`/api/webhooks/query/interpret`) returns one or more `candidates` with fully described HTTP actions (`endpoint`, `method`, `payload`).
- n8n uses one dynamic HTTP Request node per role: it reads `candidate.http.*` and forwards the request exactly as provided.
- Authorization stays server-side. Even if a workflow tries the wrong project or action, the API responds with 403/404 and the event is logged via `logWebhookEvent`.

## Accountant Parity
All accountant pages now have WhatsApp equivalents under `/api/webhooks/accountants`:

| Action | Flow | Notes |
| --- | --- | --- |
| `CREATE_PM_ADVANCE` | Mirrors PM Advance creation in the web accountant dashboard. | Validates staff/project and returns the advance with remaining balance. |
| `CREATE_STAFF_ADVANCE` | Adds a pending staff advance. | Matches `/api/staff/advances` POST validation. |
| `UPDATE_STAFF_ADVANCE` | Edits amount/note when status is still `PENDING`. | Same business rules as dashboard inline edit. |
| `DELETE_STAFF_ADVANCE` | Deletes pending staff advances. | Blocks deducted advances. |
| `RECORD_ACCOUNTING_NOTE` | Converts an accounting note, issues the claim invoice, and links PM advances. | Shares logic with accounting-note review UI. |
| `PAY_INVOICE` | Records invoice payments and handles `mark-paid`. | Mirrors `/api/invoices/[id]` PATCH. |
| `CREATE_PAYROLL` | Generates monthly payroll with deductions preview. | Identical to `/api/payroll` POST. |
| `PAY_PAYROLL` | Marks payroll as paid and deducts pending staff advances. | Same as `/api/payroll/[id]` PATCH `pay`. |

Interpreter support:
- Detects keywords for advances, accounting notes, invoices, payroll, and verbs (create/update/delete/pay).
- Builds candidate payloads with placeholders (`{{accountantPhone}}`, `{{invoiceId}}`, etc.) so n8n can fill in collected parameters.
- Adds human-readable guidance and required-parameter lists for conversational prompts.

## Project Manager Parity
Existing PM webhook `/api/webhooks/project-managers` already handles on-site workflows, now consumable via the same single-node design:

| Action | Flow |
| --- | --- |
| `CREATE_OPERATIONAL_EXPENSE` | Files operational expenses as pending accounting notes. |
| `GET_RESIDENT_PHONE` | Retrieves resident contact info for a unit. |
| `LIST_PROJECT_TICKETS` | Lists project tickets with optional status/limit filters. |

Interpreter support:
- Ticket, expense, resident keywords map to the above actions.
- Candidates require `senderPhone` and, when needed, `projectId`/`unitCode`. Missing data is surfaced via `suggestions` so the chatbot can ask follow-ups.

## Workflow Setup Checklist
1. Identity node → Interpreter node.
2. Function node injects required placeholders (e.g., `{{accountantPhone}}`, `{{projectId}}`).
3. Dynamic HTTP node uses `candidate.http.method`, `candidate.http.endpoint`, `candidate.http.query`, and `candidate.http.payload`.
4. Response node sends `humanReadable.ar` back to WhatsApp.
5. Monitor `n8nWebhookLog` for success/failure to keep parity observability with the web UI.
