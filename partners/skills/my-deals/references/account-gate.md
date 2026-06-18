# Account gate — partner vs customer

`my-deals` is **partner-scoped**: the partner viewing their own deal pipeline with a specific
customer. It must never run against a customer-admin connection.

## Why

`partner_artifacts(action:'deals', partner_id)` returns the deals registered under that partner
account. A customer-admin token carries a different scope and would either error or return
another partner's data — both outcomes are unacceptable for a self-service skill.

## Step 1 — always call `list_accounts`

```
accounts[].type                  "customer" | "partner"
accounts[].affiliate_company_name  the customer this partner belongs to (partner rows)
accounts[].dashboard_url         role-specific EULER web URL (for deep-links + the gate msg)
consent_summary { ... }
backend_data_issue? { reason, message, action_required, support_email }
```

## Decision

| Result | Action |
|--------|--------|
| At least one `type === 'partner'` entry | Proceed — use that entry's `partner_id` and `affiliate_company_name` |
| Only `type === 'customer'` entries (no partner) | Emit friendly gate message → **STOP** |
| Both partner and customer entries | Proceed as partner (use the partner entry) |

## Friendly message when the type doesn't match

Do NOT proceed and do NOT surface a raw error:

> "my-deals shows your own deals as a partner. You're connected as a customer
> admin — for a partner review use `generate-qbr`, or open your dashboard: `<dashboard_url>`."

Use the `dashboard_url` from the `type === 'customer'` entry in `list_accounts`.

## Multiple partner accounts

If `list_accounts` returns more than one `type === 'partner'` entry (rare but possible),
ask the user which customer they mean before proceeding — e.g. "I see partner connections
for both Acme Corp and Globex. Which would you like your deals from?" Then use the
`partner_id` from the chosen entry.

## `partner_id` source rule

`partner_id` comes **only** from the chosen `type: 'partner'` entry returned by
`list_accounts` (matched by `affiliate_company_name`). IDs sourced from
`partner_directory_search` are `profile_id`s scoped to the directory — they will be
rejected by flow tools with `partner_not_in_consent`. Never use a directory ID here.

## Defense-in-depth: `forbidden_scope`

If a flow tool still returns `forbidden_scope` mid-run, it carries `required_scope` +
`token_roles`. Translate into the same friendly gate message above — never show the
user the code `forbidden_scope` or any `euler_*` string.

## `backend_data_issue`

If `list_accounts` returns it: surface `support_email`, note reconnecting won't help,
and continue with whatever `partner_artifacts` returns.
