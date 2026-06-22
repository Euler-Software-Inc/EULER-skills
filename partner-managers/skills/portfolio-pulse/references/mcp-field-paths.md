# EULER MCP — response field paths for `portfolio-pulse`

> Load this only when extracting fields from a response. SKILL.md says which
> tool to call; this says what comes back.
>
> Status: **partially verified against a live run (2026-06-01, "Hexmodal" tenant).**
> The shapes below reflect what that run actually returned. The tenant was sparse
> (1 producing record, mostly unconfigured partners), so some optional fields
> weren't exercised — those are marked "verify". Read-only skill; a wrong path only
> mis-displays.
>
> Backend gotchas (apply throughout): dates are `YYYY-MM-DD`; **all numerics
> arrive as strings**; some payloads are stringified JSON — parse loosely.

## Key lessons from the 2026-06-01 live run

- `performance(action:'overall', entity_key:'revenue')` ranks by **billed/invoiced
  revenue**, not only closed-won. A $100 billing ranked while `company` reported
  **0 closed-won deals**. Label the metric "Revenue (window)", say "closed-won" only
  when deals > 0.
- The top-ranked entry came back with a **blank partner name** (unattributed) —
  render as "Unattributed", flag, keep in counts.
- `partners(action:'summary')`'s **status breakdown is unreliable** — it accounted
  for only 35 of 42 partners and disagreed with the roster. **Compute status from
  `partners(list)`**; use `summary` only for grand total + portal-access counts.
- `overall` returned the **full producing set** (1 record, not a truncated page) —
  so "1 of 42 producing" was safe. Still verify per run (check for a total/next-page).

## `list_accounts`

```
accounts[].type                     "customer" | "partner"
accounts[].name                     customer name (customer rows) — use for header
accounts[].affiliate_company_name   partner rows only
accounts[].dashboard_url            role-specific EULER URL (for the gate message)
consent_summary { hidden_count, ... }
backend_data_issue? { reason, message, action_required, support_email }
```

Use the `type === 'customer'` entry's `name` for the header. See
[`account-gate.md`](account-gate.md) for the gating logic.

## `partners(action: 'summary')`  — company-wide aggregate (use sparingly)

Returns company-wide totals + a **portal-access** split (partners with vs without
portal access) and a per-status breakdown.

```
total partners count
portal-access counts: with portal access / without          (observed 34 / 8)
status breakdown: Active / Onboarding / Prospecting / ...    ← UNRELIABLE, see below
```

⚠️ **Do NOT use the status breakdown.** On 2026-06-01 it accounted for only 35 of 42
partners and disagreed with the per-entry roster. Compute the status distribution
from `partners(list)` instead. Use `summary` only for the grand total + portal-access
counts. Current state, NOT window-filtered.

## `performance(action: 'company')`  — own-company aggregate, window-filtered

```
start_date (echoed), end_date (echoed),
booking_revenue   ($-string; 0/"$" when none)
billings_revenue  ($-string; the $100 came from here on 2026-06-01)
deals / closed-won deal count   (string; was 0)
win_rate          (string %)
```

Window-filtered. Note billings can be > 0 while closed-won deals = 0 (the $100
billing). Normalize `""`/`"$"`/`"$0"` → `$0`. Exact key casing: verify against a
populated tenant (the test tenant was near-empty).

## `performance(action: 'overall')`  — ranked partners, window-filtered (TERMINAL)

Ranks partners by `entity_key` (`revenue` default, or `deals`), `status: 'won'`,
paginated (`page`, `limit`). Returns the ranking **plus** aggregate metrics in one
call — no per-partner follow-up needed for a pulse.

```
(echoed) start_date, end_date, page, limit, entity_key, status
ranked list: per-partner { partner name (CAN BE BLANK → "Unattributed"),
                           revenue (string, $-prefixed),
                           deal count (string) }
aggregate metrics across the ranked set
total / next-page indicator  ← VERIFY per run (see note below)
```

`entity_key:'revenue'` = **billed/invoiced revenue**, NOT only closed-won, and **no
commissions**. Label "Revenue (window)"; say "closed-won" only when deal count > 0.
A blank partner name = unattributed (flag it, keep in counts). On 2026-06-01 the
ranking returned the **full producing set** (1 record), so "1 of 42 producing" was
safe — but if a run looks truncated at the page size, scope the claim to "top-N
producing" rather than implying you saw every partner.

## `partners(action: 'list')`  — roster, current state

Returns a (possibly stringified) array; loose-parse. Per entry:

```
partner_id          (orchestration only — never render)
"Partner name"
status              "Active" | "Onboarding" | "Prospecting" | "Inactive" | ""(empty)
```

**This is the canonical source for the status distribution.** Count entries by
`status`; an empty `status` is the **"No status set"** cohort (was 32 of 42 on
2026-06-01 — often the dominant bucket and the #1 needs-attention item). Page with
`page`/`limit` (e.g. limit 100); if the roster exceeds the cap, note the truncation
rather than implying you saw everyone. Derive "needs attention" from `status` +
absence from the `overall` revenue ranking. Watch for obvious test entries
(e.g. "UUU") — flag, keep in counts.

## `get_partner_overall_stats`  — single-call snapshot (Path A, lifetime)

No params; customer-scoped automatically; **lifetime-to-date, unfiltered**. Returns the
headline totals + the top 100 partners by revenue in one backend-aggregated call.

```
total_partners / active_partners / pending_partners   counts (string-numeric → parse)   [verify key casing]
total_deals / won_deals                               counts (string-numeric → parse)
total_revenue                                         sum, $-string; normalize ""/"$"/"$0" → $0
top_partners[]   top 100 by revenue, each:
  { partner name (may be blank → "Unattributed"), revenue ($-string), deal count (string) }
```

New tool (shipped on `dev` first) — **exact keys are unverified; confirm against the first
live run.** Numerics arrive as strings; a blank partner name = "Unattributed" (flag, keep in
counts). Lifetime-to-date — label the basis "lifetime", never a window. **If the tool is
unavailable or errors, fall back to Path B** (see SKILL.md §Orchestration).

## `company_invoices(action: 'summary')`  — company-wide collections

```
totals by status: paid / pending / processing   ($-strings → parse + normalize)   [verify key casing]
```

**Company-level (program-wide), NOT partner-scoped** — never attribute to a single partner.
`action: 'list'` (unused here) returns individual invoices with filters. Skip silently if
empty/forbidden.
