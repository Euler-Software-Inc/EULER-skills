# MCP field paths — my-referrals

> Exact field paths and quirks for the two tool calls this skill makes.
> Numerics arrive as strings — always `Number()` before math or sort.
> Dates are `YYYY-MM-DD` strings.

## list_accounts — always first (gate + partner_id)

```
accounts[]
  .type                    "customer" | "partner"
  .partner_id              use ONLY this for downstream calls (type:'partner' rows)
  .affiliate_company_name  customer this partner belongs to (use for topbar header)
  .dashboard_url           deep-link for gate message fallback
consent_summary { ... }
backend_data_issue? { reason, message, action_required, support_email }
```

`partner_id` comes **only** from `list_accounts` (`type:'partner'` entry). Never
use an ID from `partner_directory_search` — those `profile_id`s are rejected
downstream as `partner_not_in_consent`.

## referrals(action:'for_partner', partner_id) — lifetime

Returns the partner's own submitted referrals (paginated).

```
referrals[]
  [company name field]   display name of the referred company
  [type field]           "Referral" | "Deal registration"
  [status field]         "pending" | "approved" | "rejected" (or other raw value)
  "Submitted On"         YYYY-MM-DD — the submission date (real field; do not fabricate)
result_per_page          pagination metadata (see quirk below)
```

**Loose-JSON parse (required).** The `referrals` response has a known serialization
quirk: the `result_per_page` pagination field uses commas instead of colons in some
serializations. Parse the entire response defensively — do not assume well-formed JSON.
On parse failure, surface the count if available; never render fabricated rows.

**Status pill mapping:**

| Raw status | Pill class | Label |
|------------|-----------|-------|
| `pending`  | `amber`   | 🟡 Pending |
| `approved` | `green`   | 🟢 Approved |
| `rejected` | `red`     | 🔴 Rejected |
| other      | `gray`    | render raw value |

**Sort:** most-recent first by `Submitted On`. `Number()` is not needed for dates
(string sort on ISO format is correct), but verify the field is a parseable date before
sorting — skip un-parseable values rather than crashing.

**Test-data heuristic:** placeholder names (`asdf`, `test`, `foo`, purely numeric, or
the partner's own company name as the referred company) are likely test entries. Append
`(test?)` to the company name in the table and mention the count in a footer note.
Keep them in all counts — the partner owns that cleanup decision.

**Empty state:** if `referrals[]` is empty or absent, skip the table and render a
positive note: "No referrals yet — submit your first with `/euler-for-partners:submit-a-referral`."

**Pagination:** if `result_per_page` indicates more pages, fetch subsequent pages until
all referrals are loaded. Cap the rendered table at ~50 rows; add a footnote if more.
