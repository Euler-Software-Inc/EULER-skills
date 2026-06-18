# Account gate — customer vs partner

> Load this at Step 1. It checks the connected account's type and degrades
> gracefully when the type doesn't match the skill. **UX gate, not a security
> boundary** — the MCP enforces scope server-side regardless.

## Why

EULER accounts carry roles: a connection can be a **customer** (the program owner)
and/or a **partner** (a partner of some customer). Tools are scoped
`customer | partner | both`. `pending-approvals-triage` is customer-scope; called
from a partner-only account it would hit a raw `forbidden_scope` code. Gate first.

## Step 1 — always call `list_accounts`

```
accounts[].type            "customer" | "partner"
accounts[].name            customer name (customer rows) — header
accounts[].dashboard_url   role-specific EULER web URL (for deep-links + the gate msg)
consent_summary { ... }
backend_data_issue? { reason, message, action_required, support_email }
```

## Decision

- Has a `type === 'customer'` entry → proceed in customer context.
- Only `type === 'partner'` entries → **friendly message + STOP** (below).
- Both → proceed as customer.

## Friendly message when the type doesn't match

Do NOT proceed and do NOT surface a raw error:

> "**pending-approvals-triage** is for customer admins / partner managers (the company
> that hosts the partner program), so this approval queue isn't available on a
> **partner** account. To see your own data with a customer, try
> **`/euler:my-performance`**; to manage your program, open your dashboard:
> `<dashboard_url>` (from `list_accounts`)."

## Defense-in-depth: `forbidden_scope`

If a tool still returns `forbidden_scope` mid-run, it carries `required_scope` +
`token_roles`. Translate into the same friendly message — never show the user the
code `forbidden_scope` or any `euler_*` string.

## `backend_data_issue`

If `list_accounts` returns it: surface `support_email`, note reconnecting won't help,
and continue with whatever the other tools return.
