# Account gate — partner vs customer

> Load this at Step 1. It checks the connected account's type and degrades
> gracefully when the type doesn't match the skill. **UX gate, not a security
> boundary** — the MCP enforces scope server-side regardless.

## Why

EULER accounts carry roles: a connection can be a **customer** (the program owner)
and/or a **partner** (a partner of some customer). Tools are scoped
`customer | partner | both`. `my-tracking-links` is a **partner action** — a
partner managing their OWN affiliate tracking links. Called from a customer-only
account it would hit a raw `forbidden_scope` code. Gate first.

## Step 1 — always call `list_accounts`

```
accounts[].type                    "customer" | "partner"
accounts[].affiliate_company_name  the customer this partner belongs to (partner rows)
accounts[].dashboard_url           role-specific EULER web URL (for deep-links + the gate msg)
consent_summary { ... }
backend_data_issue? { reason, message, action_required, support_email }
```

## Decision

- Has a `type === 'partner'` entry → proceed in partner context.
- Only `type === 'customer'` entries → **friendly message + STOP** (below).
- Both → proceed as partner (use the partner entry).

## Friendly message when the type doesn't match (customer-only)

Do NOT proceed and do NOT surface a raw error:

> "my-tracking-links is a partner action — only a partner manages their own
> tracking links. You're connected as a customer admin. To manage program links,
> open your dashboard: `<dashboard_url>`."

Use the `dashboard_url` from the `type === 'customer'` entry in `list_accounts`.

## Multiple partner accounts

If `list_accounts` returns more than one `type === 'partner'` entry:

- Match the one whose `affiliate_company_name` equals the customer the user named in
  their request (the customer the tracking link is for).
- If still ambiguous (user named no customer, or name matches multiple entries), ask
  the user which partner account to use — show the list of `affiliate_company_name`
  values.
- One partner + customer pairing per invocation. Do not fan out across accounts, and
  never create the same link under more than one account.

## `partner_id` source rule

`partner_id` comes **only** from the chosen `type: 'partner'` entry returned by
`list_accounts` (matched by `affiliate_company_name`). IDs sourced from
`partner_directory_search` are `profile_id`s scoped to the directory — they will be
rejected by flow tools with `partner_not_in_consent`. Never use a directory ID here,
and never use `partner_directory_search` in this skill at all.

## Defense-in-depth: `forbidden_scope`

If a flow tool (`partner_artifacts` / `create_tracking_link`) still returns
`forbidden_scope` mid-run, it carries `required_scope` + `token_roles`. Translate into
the same friendly gate message above — never show the user the code `forbidden_scope`
or any `euler_*` string. On any such error, do **not** claim a link was created.

## `backend_data_issue`

If `list_accounts` returns it: surface `support_email`, note reconnecting won't help.
For a write skill, do not attempt `create_tracking_link` if the gate could not resolve
the `partner_id` — surface the friendly reason instead.
