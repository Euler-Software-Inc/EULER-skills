# `generate-qbr` — v0.8 output enhancements (detailed rules)

> Load this reference when rendering the HTML output. SKILL.md gives you
> the orchestration + short rule summaries; this file has the detailed
> rendering behavior for the four v0.8 enhancements: Q-over-Q,
> sparklines, the Impact column on action items, and the data confidence
> indicator.

## Table of contents

1. [Q-over-Q comparison](#q-over-q-comparison)
2. [Sparkline rules](#sparkline-rules)
3. [Impact column in action items](#impact-column-in-action-items)
4. [Data confidence indicator](#data-confidence-indicator)
5. [Known limitations](#known-limitations)

## Q-over-Q comparison

Every QBR includes the previous quarter's metrics inline. Call
`performance` twice (current + prev quarter) and compute deltas for
each headline metric. Render as:

- **In the TL;DR:** when the QoQ change is material (≥10% absolute
  change in revenue, or any change in deal count), the headline
  mentions it (*"$10K closed vs $5K last quarter, +100%"*).
- **In the Key Numbers table:** a `Δ vs Q<N-1>` column shows the delta
  with arrow and percentage (`↑ +47%` green / `↓ −12%` red / `→ no change` gray).
- **When current period is dormant (all zeros) but historical data
  exists:** lean on the sparkline (see below) rather than the delta.
  A "0 → 0, no change" cell is noise — omit per Rule 1.

For sparklines and richer history, fetch 3 more quarters (`performance`
×3) — Q-2 through Q-4. Total `performance` calls per QBR: 5. Skip the
historical fetch if the user explicitly asks for "fast" or "lite" mode.

## Sparkline rules

In stat cards that display **temporal numeric data** (billings revenue,
booking revenue, deal count), render an inline SVG sparkline below the
stat value showing the last 5 quarters' trend.

SVG specs:
- `viewBox="0 0 100 24"`, no external deps
- Stroke `var(--brand-600)` at 1.5px, fill none
- Polyline through 5 points, normalized to the max value across the series
- Closing circle marker at the rightmost (current period) data point
- Use class `.sparkline` for styling hooks
- Optional `.spark-fill` polygon underneath for area fill (semi-transparent)

Do NOT render a sparkline for:
- Stat cards showing non-numeric / categorical data (Agreements "3 / 5")
- Stat cards where all 5 historical points are zero (no trend)
- Counts that vary by ≤1 across the series (a flat line is noise)

## Impact column in action items

Every action row in the "What needs to happen" table has an Impact line
inline (rendered as `<span class="impact">` under the action text).
The impact must derive from real data, not be invented:

- ✅ Good: *"Blocks $50K Acme deal from progressing past Stage 1"*
  (Acme is in our pipeline, $50K is in our data)
- ✅ Good: *"Unlocks commission rate at next tier — current pipeline at
  $58K would qualify"* (pipeline number from our data)
- ✅ Good: *"7 prospects × ~$15K avg lifetime ACV ≈ $105K potential
  pipeline"* (multiplication of real referral count × cohort avg)
- ❌ Bad: *"Improves partnership trust"* (vague, unmeasurable)
- ❌ Bad: *"Industry best practice"* (generic)

When you cannot derive a concrete impact from data, drop the action
item rather than emit a vague one — Rule 7 still applies (all 5 cells
filled or row is removed).

## Data confidence indicator

Add a `<span class="data-pill ...">` next to the status pill in the
header, summarizing how complete the underlying data fetch was:

- **`data-pill complete`** (green) — all expected tool calls returned
  data or expected-empty
- **`data-pill partial`** (amber) — one or more tools returned an
  unexpected empty/error response; the doc renders normally but is
  missing one or more sections it would otherwise include
- **`data-pill stale`** (gray) — historical comparison data is older
  than 90 days from the period end (e.g. a Q1 2026 QBR with no Q4 2025
  data on file)

The pill tooltip (HTML `title` attribute) lists which sources are
incomplete.

## Known limitations

Things the skill cannot do today, by tool constraint. Logged for
upstream MCP improvements:

- **No partner CRM ID exposed.** Customer-side tools return the
  EULER-internal `partner_id` only. Partner managers want the CRM ID
  (HubSpot / Salesforce / Pipedrive object id) in their QBR. Pending
  upstream MCP change — once added to `partners(list)`, `list_accounts`,
  and `performance(partner)` responses, surface it in the header.
- **No period filter for deals / referrals / agreements / invoices.**
  Listed as all-time. Workaround: parse `"Submitted On"` for referrals
  and approximate.
- **No `closed_on` date in deals.** `last_stage_change_date` is a
  duration, not a timestamp.
- **No `expires_on` for agreements.** Cannot surface renewal risk.
- **No MDF / incentives data per partner.** `incentives_summary`
  exists but returns company-wide, not per-partner.
