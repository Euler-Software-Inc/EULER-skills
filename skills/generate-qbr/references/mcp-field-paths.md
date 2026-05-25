# EULER MCP — Response field paths for `generate-qbr`

> Load this reference only when you need to extract specific fields from
> an MCP response. SKILL.md tells you which tool to call and when; this
> file tells you exactly what comes back and which field to read.

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
- [partner_artifacts(action: 'invoices')](#partner_artifactsaction-invoices)

## `list_accounts`

```
accounts[].id, .type, .name, .company_id, .partner_id, .affiliate_company_name (partner only), .dashboard_url
consent_summary.hidden_count
```

For the QBR header, the customer-side `name` (where `type === 'customer'`)
is what to print as `<Customer name>`.

## `partners(action: 'list')`

Returns a stringified-JSON-array under `response.result` — loose parsing
required (see SKILL.md Rule 10). Each entry:

```
partner_id, "Partner name", status
```

`status` may be empty string for unconfigured partners.

## `performance(action: 'partner')`

```
partner_id, start_date (echoed), end_date (echoed),
total_deals_count (string, may be "0"),
booking_revenue (string with "$" prefix; may be just "$" when zero — see Rule 5),
billings_revenue (string like "$100.00"),
win_rate (string like "0.00%"),
sales_cycle (string like "0 Days"),
avg_contract_value (string like "$0"),
partner_status
```

Period-filtered. Date params must be `YYYY-MM-DD` (see SKILL.md "Date
format gotcha").

## `partner_artifacts(action: 'deals')`

```
total_items (string), page, limit, partner_id,
Result[].deal_id
Result[].Amount                          string, raw number, NO currency prefix (e.g. "500")
Result[]."crm status (deal_stage)"       yes, with spaces and parens — use this exact key
Result[]."Deal name"
Result[].last_stage_change_date          string like "20599 Days" — DURATION, not a date
```

Lifetime, not period-filtered. Sort `Result[]` by `Amount` descending
when rendering open deals.

`last_stage_change_date` is a duration string — see SKILL.md Rule 15
(no fake aging signals).

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

Lifetime, not period-filtered. For the "Submitted in period" line in
the output template, parse `"Submitted On"` strings (formats observed:
`"Feb 26, 2026"`, `"May 9, 2024"`, `"Oct 30, 2025"`) and count those
between `start_date` and `end_date`.

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

## `partner_artifacts(action: 'invoices')`

When empty: `Result: [Empty (this search did not return any results)]`.
When populated, treat field names as case-sensitive and document on first
encounter (no validated example available as of 2026-05-25).
