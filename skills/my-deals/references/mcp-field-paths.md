# MCP field paths — my-deals

## list_accounts — always first (gate + partner_id)

```
accounts[].type                    "customer" | "partner"
accounts[].partner_id              use ONLY from the type:'partner' entry
accounts[].affiliate_company_name  customer name for this partner (header + gate)
accounts[].dashboard_url           deep-link for the gate redirect message
consent_summary { ... }
backend_data_issue? { reason, message, action_required, support_email }
```

`partner_id` must come from the `type: 'partner'` entry — never from
`partner_directory_search` (those are directory `profile_id`s, rejected as
`partner_not_in_consent` by downstream tools).

## partner_artifacts(action:'deals', partner_id) — lifetime

Returns the partner's full deal list (open + closed). Key fields:

```
[].Deal name              string  — the deal label to display
[].stage                  string  — funnel stage (e.g. Qualified, Demo, Negotiating, Contracting, Closed Won, Closed Lost)
[].Amount                 string  — numeric as string; parse with Number(); format as currency
[].last_stage_change_date string  — DURATION (days elapsed in current stage)
```

### `last_stage_change_date` aging rule (critical)

`last_stage_change_date` is a duration string representing the number of days the deal has
been in its current stage. **Values ≥ 9999 days are a null/garbage sentinel** — the backend
emits this when no real date is available. Rules:

- `Number(last_stage_change_date) < 9999` → valid; render as "N days in stage" in `.cell-note`
- `Number(last_stage_change_date) >= 9999` → sentinel; **NEVER render as aging**; omit the `.cell-note` entirely
- When `last_stage_change_date` is absent or non-numeric → treat as sentinel; omit aging

Do not fabricate aging from any other source. No aging = no `.cell-note`.

### Stage grouping for the pipeline table

Group open deals by stage in funnel order (earliest → latest). Typical order:
Qualified → Demo → Negotiating → Contracting → (other stages as they appear).
Sort by `Amount` descending within each stage group.

Closed-won deals: surface count + total value in the hero quick-facts only.
Closed-lost deals: omit from the report entirely if their total `Amount` is $0; include
the count only if there is a non-zero lost amount worth surfacing.

### Numerics

All monetary fields arrive as strings. Always parse with `Number()` before arithmetic or
formatting. Currency normalization: if no currency symbol is present, default to USD display.

## get_search_deals(deal_name, partner_id) — single-deal lookup

Use **only** when the user explicitly names a deal (e.g. "look up my Lumon deal"). Do not
call this for the general pipeline view — `partner_artifacts(action:'deals')` already returns
the full list. Returns the matching deal record with the same field shape as above.
