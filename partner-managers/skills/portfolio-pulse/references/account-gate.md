# Account gate — customer vs partner

> Load this when running the skill's Step 1. It encodes how to check the
> connected account's type and how to degrade gracefully when the type doesn't
> match the skill. This is a **UX gate**, not a security boundary — the MCP
> enforces scope server-side regardless.

## Why

EULER accounts have roles: a connection can be a **customer** (the program owner)
and/or a **partner** (a partner of some customer). Tools are scoped
`customer | partner | both`. A customer-scope skill called from a partner-only
account would otherwise hit a raw `forbidden_scope` code — confusing. Gate first.

## Step 1 — always call `list_accounts`

It returns every account context the connection can act on:

```
accounts[].type            "customer" | "partner"
accounts[].name            customer name (for customer rows)
accounts[].affiliate_company_name   (partner rows only)
accounts[].dashboard_url   role-specific EULER web URL
consent_summary { ... }
backend_data_issue? { reason, message, action_required, support_email }
```

## Decision tree

| Connected account has… | This skill requires… | Action |
|---|---|---|
| a `type === 'customer'` entry | customer | proceed in customer context |
| only `type === 'partner'` entries | customer | **friendly message + STOP** (below) |
| a matching type | partner / either | proceed |
| both types | a specific type | proceed in the required one |

## Friendly message when the type doesn't match

Do NOT proceed and do NOT surface a raw error. Say, in plain language:

> "**portfolio-pulse** is for customer admins / partner managers (the company that
> hosts the partner program). Your EULER connection is a **partner** account, so
> this view isn't available. For your own data with a customer, try
> **`/euler-for-partners:my-performance`**. To manage your partner program, open your dashboard:
> `<dashboard_url>` (from `list_accounts`)."

Substitute the skill name + suggested alternative per skill.

## Defense-in-depth: translating `forbidden_scope`

If a tool call still returns `forbidden_scope` mid-run (shouldn't happen after the
gate), it carries `required_scope` + `token_roles`. Translate into the same friendly
message — never show the user the code `forbidden_scope` or any `euler_*` string.

## `backend_data_issue`

If `list_accounts` returns a `backend_data_issue` object: surface its `support_email`
to the user, explain reconnecting will NOT help, and continue with whatever other
company-scope tools return (they may still work).
