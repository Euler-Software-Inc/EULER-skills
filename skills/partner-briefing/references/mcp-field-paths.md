# EULER MCP — Response field paths for `partner-briefing`

> Load this reference only when you need to extract specific fields from
> an MCP response. SKILL.md tells you which tool to call and when; this
> file tells you exactly what comes back and which field to read.
>
> This skill and `generate-qbr` hit the same MCP backend and share these
> field paths. This is a self-contained copy so the skill works when
> packaged standalone (uploaded as a skill zip to claude.ai) — keep it in
> sync with `generate-qbr/references/mcp-field-paths.md` when the backend
> shape changes.

The MCP backend (Bubble-based) returns inconsistent field names. Use
these **exact** paths — verified against staging on 2026-05-25. If a path
you would want is missing here, the field doesn't exist in the response
and you should not invent it.

## Table of contents

- [list_accounts](#list_accounts)
- [partners(action: 'list')](#partnersaction-list)
- [performance(action: 'partner')](#performanceaction-partner)
- [partner_artifacts(action: 'deals')](#partner_artifactsaction-deals)
- [commissions(action: 'partner')](#commissionsaction-partner)
- [referrals(action: 'for_partner')](#referralsaction-for_partner)
- [partner_artifacts(action: 'agreements')](#partner_artifactsaction-agreements)

## `list_accounts`

```
accounts[].id, .type, .name, .company_id, .partner_id, .affiliate_company_name (partner only), .dashboard_url
consent_summary.hidden_count
```

A briefing rarely renders the customer-side name (internal prep needs no
doc header), but `list_accounts` is still the first call when the user has
an account with the partner.

## `partners(action: 'list')`

Returns a stringified-JSON-array under `response.result` — loose parsing
required (see SKILL.md anti-hallucination rules). Each entry:

```
partner_id, "Partner name", status
```

`status` may be empty string for unconfigured partners.

## `performance(action: 'partner')`

```
partner_id, start_date (echoed), end_date (echoed),
total_deals_count (string, may be "0"),
booking_revenue (string with "$" prefix; may be just "$" when zero — normalize to $0),
billings_revenue (string like "$100.00"),
win_rate (string like "0.00%"),
sales_cycle (string like "0 Days"),
avg_contract_value (string like "$0"),
partner_status
```

Period-filtered. Date params must be `YYYY-MM-DD` (see SKILL.md "Date
format gotcha"). For the briefing's previous-window delta, call this twice
(current window + the equivalent window before it).

## `partner_artifacts(action: 'deals')`

```
total_items (string), page, limit, partner_id,
Result[].deal_id
Result[].Amount                          string, raw number, NO currency prefix (e.g. "500")
Result[]."crm status (deal_stage)"       yes, with spaces and parens — use this exact key
Result[]."Deal name"
Result[].last_stage_change_date          string like "20599 Days" — DURATION, not a date
```

Lifetime, not period-filtered. `last_stage_change_date` is a duration
string — values ≥ 9999 Days are the sentinel/null garbage (never cite);
values < 9999 Days are real aging signals (see SKILL.md aging rule).

## `commissions(action: 'partner')`

When empty, returns the literal string `"Empty (this search did not return any results)"`.
When populated, shape varies — read it and adapt; do not assume structure.

Period-filtered.

## `referrals(action: 'for_partner')`

Returns `result_per_page` as a stringified JSON-like blob with a
**serialization bug**: pairs use commas instead of colons
(`{"id","value"}` instead of `{"id":"value"}`). Parse loosely.

Fields per entry:

```
id, "Referred company name", Status, "Submitted On"
```

Lifetime, not period-filtered. To filter to the briefing window, parse
`"Submitted On"` strings (formats observed: `"Feb 26, 2026"`,
`"May 9, 2024"`, `"Oct 30, 2025"`) and keep those between `start_date`
and `end_date`.

## `partner_artifacts(action: 'agreements')`

Returns `Result[]` with **corrupted keys** (the `id` field appears as
`ïd` with a diaeresis — skip it).

Usable fields per entry:

```
"agreement Name"      note lowercase 'agreement'
Status
"Signed On"           may be empty string when unsigned
```

There is **no `expires_on` / renewal-date field**. Do not write
"expires YYYY-MM-DD" in output — the data doesn't exist.

Status string → emoji map (case-insensitive):
- `Complete`, `Signed`, `Active`, `Executed` → 🟢
- `Pending`, `Draft`, `In Review`, `Out for Signature` → 🟡
- `Expired`, `Terminated`, `Revoked`, `Cancelled` → 🔴

Default to 🟡 for unknown statuses and render the raw status next to it.
