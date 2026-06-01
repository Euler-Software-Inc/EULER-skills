# EULER MCP — response field paths for `portfolio-pulse`

> Load this only when extracting fields from a response. SKILL.md says which
> tool to call; this says what comes back.
>
> ⚠️ **PROVISIONAL — validate against the live connector before trusting in prod.**
> Unlike the per-partner shapes used by `generate-qbr`, the company-wide shapes
> below (`performance(overall|company)`, `partners(summary)`) were written from
> the euler-mcp functional catalog, NOT empirically verified from a live response.
> On the first real run, inspect the actual payload and correct any path here.
> The skill is read-only, so a wrong path only mis-displays — no side effects.
>
> Backend gotchas (apply throughout): dates are `YYYY-MM-DD`; **all numerics
> arrive as strings**; some payloads are stringified JSON — parse loosely.

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

## `partners(action: 'summary')`  — company-wide aggregate

Returns company-wide partner totals broken down by **roster status** (Active /
Onboarding / Prospecting / Inactive). Treat the response as stringified/loose and
parse defensively. Expected fields (verify on first run):

```
total partners count
counts per status: Active, Onboarding, Prospecting, Inactive (+ any others)
```

This is **current state**, NOT window-filtered. Use it for the status distribution
+ portfolio totals; never label these counts as "in the window".

## `performance(action: 'company')`  — own-company aggregate, window-filtered

```
start_date (echoed), end_date (echoed),
company-level aggregate: sales / deals / charges figures
```

Window-filtered. Use for portfolio totals context. Currency fields may come with a
`$` prefix or empty — normalize `""`/`"$"`/`"$0"` → `$0`.

## `performance(action: 'overall')`  — ranked partners, window-filtered (TERMINAL)

Ranks partners by `entity_key` (`revenue` default, or `deals`), `status: 'won'`,
paginated (`page`, `limit`). Returns the ranking **plus** aggregate metrics in one
call — no per-partner follow-up needed for a pulse.

```
(echoed) start_date, end_date, page, limit, entity_key, status
ranked list: per-partner { partner name, revenue (string, $-prefixed), deal count (string) }
aggregate metrics across the ranked set
possibly a total_items / total count  ← VERIFY: determines whether you can compute
                                          a true portfolio-wide "% producing"
```

Won deals only — **no commissions**. Label revenue as "closed-won revenue (window)".
If there is no full-portfolio total, scope any "% producing" claim to the returned
page (e.g. "top-N producing"), don't imply you saw every partner.

## `partners(action: 'list')`  — roster, current state

Returns a (possibly stringified) array; loose-parse. Per entry:

```
partner_id          (orchestration only — never render)
"Partner name"
status              may be empty for unconfigured partners
```

Page with `page`/`limit` (e.g. limit 100); if the roster exceeds the cap, note the
truncation rather than implying you saw everyone. Use status + absence from the
`overall` won-ranking to derive the "needs attention" segment.
