# EULER MCP — response field paths for `pending-approvals-triage`

> Load this only when extracting fields. SKILL.md says which tool to call.
>
> ⚠️ **PROVISIONAL — validate against the live connector on first run.** The shapes
> below were written from the euler-mcp catalog, not seen live from this env. The
> skill is read-only, so a wrong path only mis-displays — correct it from the real
> payload. Specifically confirm whether `partners(action:'pending')` carries an
> applied/created date (needed for the age calc).
>
> Backend gotchas: numerics arrive as strings; parse `"Submitted On"` loosely; some
> payloads are stringified JSON.

## `list_accounts`

```
accounts[].type            "customer" | "partner"
accounts[].name            customer name (customer rows) — header
accounts[].dashboard_url   role URL (deep-link "Approve in dashboard" + gate message)
backend_data_issue? { ..., support_email }
```

See [`account-gate.md`](account-gate.md) for gating.

## `partners(action: 'pending')`

Partners awaiting approval. Body sent: none AI-supplied (worker injects company_id).
Expected per entry (verify on first run):

```
partner name / company name
applied or created date   ← VERIFY it exists; if absent, list without age
status                    (should reflect the pending/awaiting state)
```

If there's no usable date, render these items with age "—" and note it.

## `referrals(action: 'search')` — pending Referrals AND Deal Registrations

Two calls — `os_referral_type` is required: one `'Referral'`, one
`'Deal Registration'`, both with `filter_status: 'pending'`. Returns a search result
that may use the same loose/stringified shape as `referrals(for_partner)` (commas
instead of colons in `result_per_page` — parse loosely). Per entry:

```
id                          (orchestration only — never render)
"Referred company name"     the item label
Status                      (the pending state)
"Submitted On"              real date → compute waiting age (formats like
                            "Feb 26, 2026", "May 9, 2024")
os_referral_type / type     to tag the row (Referral vs Deal Registration);
                            if the response doesn't echo it, tag from which call it came
amount / value              VERIFY — deal registrations may carry a $ amount; optional
```

`filter_status` matches Bubble literally — use exact lowercase `pending`. Other
statuses exist (`approved`, `rejected`, `creating`, CRM-error variants) but v1 only
queries `pending`.

## Deriving the worklist

Merge partner-pending + both referral searches into one list, tag each by type,
sort by waiting age (oldest first), color by SLA (>14d / 7–14d / <7d). Items with no
parseable date sort last and show age "—".
