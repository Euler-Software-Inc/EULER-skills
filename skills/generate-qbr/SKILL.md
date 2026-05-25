---
name: generate-qbr
description: Generate a Quarterly Business Review (QBR) document for a specific partner using EULER MCP tools. Use this skill whenever the user mentions a QBR, quarterly review, partner business review, quarterly performance summary, or asks to "review", "summarize", or "report on" how a specific partner has been doing — even if they only describe the intent without using the term "QBR".
---

# Generate QBR — Quarterly Business Review for a partner

## When to use this skill

Invoke this skill when the user types any of:

- "QBR for <partner>"
- "Quarterly review of <partner>"
- "Generate Q<N> business review for <partner>"
- "Make a quarterly summary for <partner>"
- `/euler:generate-qbr`

DO NOT invoke for:

- Company-wide reviews (use `performance(action: 'company')` directly)
- Customer-level QBRs (different audience, different metrics)
- Non-partner accounts

## Inputs needed from user

Before running, confirm with the user:

### 1. Which partner?

- Accept either a partner name or a `partner_id`.
- Resolution order:
  1. Call `list_accounts` — if the user has an account with that partner
     (rare; user is usually customer-side), match `affiliate_company_name`
     (case-insensitive).
  2. Otherwise call `partners(action: 'list', filter_name: '<name>')` — this
     is the customer-admin path. Match against `"Partner name"` in the
     response (case-insensitive substring).
- If multiple matches, list them with their `status` field and ask the
  user to pick.
- If no match, tell the user the partner isn't visible in their account
  and offer to list all partners (`partners(action: 'list')` without
  filter, page through if needed).

### 2. (Optional) JBP target for the quarter

- If the user offers a target (revenue or deal count for the quarter),
  capture it. Used for the **vs-target column** in the headline table
  and to compute attainment % in the TL;DR.
- If not offered, do NOT ask — proceed without targets. The TL;DR
  narrative adapts (focuses on pipeline health and partner activation
  signals instead of attainment).
- Future versions will fetch JBP targets from a dedicated MCP tool.

### 3. Which quarter?

- Accept any of: `"Q1 2026"`, `"Q4 2025"`, explicit ISO dates, `"last quarter"`,
  `"this quarter"`.
- Convert to `start_date` / `end_date` in **`YYYY-MM-DD`** format:
  - Q1 = Jan 1 – Mar 31
  - Q2 = Apr 1 – Jun 30
  - Q3 = Jul 1 – Sep 30
  - Q4 = Oct 1 – Dec 31
- If `"last quarter"` or ambiguous, infer from today's date and **CONFIRM with
  the user before proceeding**. Never silently guess.

> ⚠️ **Date format gotcha:** the `performance` tool's schema description says
> "ISO 8601 UTC datetime (e.g. '2024-04-07T00:00:00.000Z')". Empirically
> (validated 2026-05-25) that format is broken — the backend returns
> corrupted years like "Nov 28, 4763". Use `YYYY-MM-DD` for ALL date
> params across all tools. If a future MCP release fixes the parser,
> revisit.

## Orchestration sequence

Run these EULER MCP tools in order. Default to running them all for a
standard QBR. Skip a step only if the user's framing explicitly excludes it
(e.g. "QBR without commissions").

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Customer-side `name` for the QBR header (the customer hosting the partnership). |
| 2 | `partners(action: 'list', filter_name: '<name>')` | Resolves `partner_id` from a name. Skip if user provided `partner_id` directly. |
| 3 | `performance(action: 'partner', partner_id, start_date, end_date)` | **Period-filtered** headline metrics: deal count, booking/billings revenue, win rate, sales cycle, ACV. |
| 4 | `partner_artifacts(action: 'deals', partner_id, page: 1, limit: 20)` | **All-time** deals pipeline (NOT period-filtered — see disclaimer rule below). |
| 5 | `commissions(action: 'partner', partner_id, start_date, end_date)` | Period-filtered commissions paid + breakdown. |
| 6 | `referrals(action: 'for_partner', partner_id, page: 1, limit: 20)` | **All-time** referrals submitted by the partner (NOT period-filtered). |
| 7 | `partner_artifacts(action: 'agreements', partner_id)` | Agreement list with `Status` + `Signed On`. No `expires_on` field available. |
| 8 | `partner_artifacts(action: 'invoices', partner_id, page: 1, limit: 20)` | All-time invoices. Include only if non-empty. |

### Tool-by-tool response field paths

The MCP backend returns inconsistent field names (Bubble-side quirks).
The exact paths and serialization bugs per tool are documented in
[`references/mcp-field-paths.md`](references/mcp-field-paths.md) —
consult that file when extracting fields from a specific response.

Key gotchas to keep in mind (the file has the full detail):
- Some keys have spaces, lowercase first letters, or unicode noise
  (`"Deal name"`, `"agreement Name"`, `ïd`)
- All numeric fields come back as strings
- `referrals(for_partner)` has a JSON serialization bug (commas instead
  of colons in `result_per_page`) — parse loosely
- `last_stage_change_date` on deals is a duration string, not a
  timestamp (see Rule 15)

### Error handling during orchestration

- **`partner_not_in_consent`** → abort. Tell the user to disconnect + reconnect
  and include this partner in their consent selection. Do not generate a partial
  QBR.
- **`backend_data_issue`** on `list_accounts` → continue with `partners(list)`
  for partner_id resolution; surface the `support_email` in a banner at the
  top of the output.
- **`euler_session_expired` / `euler_user_token_missing`** → instruct the user
  to follow Claude's inline reconnect prompt, then retry.
- **Any single tool returning empty data mid-sequence** → continue. The output
  format handles missing sections gracefully (see Rule 1).
- **A tool errors mid-run** → continue with the remaining tools, then surface
  a banner at the top of the output listing which sections are incomplete and
  why.

## Output format

This is an **executive-readable** document. A partner manager should be
able to skim it in 30 seconds and walk into a partner call ready.
Markdown only — no HTML, no internal field paths, no system terminology.

Use this exact structure. Sections marked **CONDITIONAL** are omitted
entirely when their underlying data is empty. Do not print "No X data"
placeholders inside the rendered doc — silence the section instead.

### Status traffic light (computed)

Compute the partner's status indicator once, at the start, by these rules
in order (first match wins):

| Indicator | Conditions |
|-----------|------------|
| ⚪ **Inactive** | `partner_status` = "Inactive" — frame as reactivate-or-offboard decision |
| 🔴 **Red** | `partner_status` = "Active" AND `total_deals_count` (period) = 0 AND open pipeline ≤ 1 deal AND lifetime closed-won = 0 (partner can't operate or hasn't produced) |
| 🔴 **Red** | `partner_status` = "Active" AND foundational agreement (MNDA / master / partner / agency agreement) unsigned AND lifetime closed-won = 0 (foundational gap blocks revenue) |
| 🟡 **Amber** | `partner_status` = "Active" AND lifetime closed-won ≥ 1 AND any operational concern (0 closes in period, unsigned agreements, stale pipeline). Partner is producing but has a real gap. |
| 🟡 **Amber** | `partner_status` ∈ {"Onboarding", "Prospecting"} — pre-production stages, low activity is the baseline |
| 🟢 **Green** | `partner_status` = "Active" AND closed-won in period ≥ 1 AND no foundational agreement gap |

> Heuristic: an unsigned agreement at a partner with lifetime production is
> an Amber concern, not a Red blocker — they're already operating. Red is
> reserved for partners who literally cannot or did not produce.

### Template

```markdown
# <Partner name> — Q<N> <Year>

## TL;DR

<emoji> **<one-line headline that names the state>**.
<EXACTLY 2 sentences, max 3. Biggest signal + biggest risk, with the one
number that matters most embedded inline. Prose only — no tables, no
bullets, no lists.>
**Recommended next step:** <one sentence, ONE focused action — not a list joined by "and">.

---

## What happened in Q<N>

<2–4 sentences of prose summarizing the period. Pull from
performance metrics + most material pipeline movement. Frame in
business terms ("Axion closed nothing in Q1") not system terms
("performance.total_deals_count was 0").>

**Key numbers** (period-filtered) [CONDITIONAL — omit table if all
displayed rows would be zero/N/A]:

| Metric | Q<N> <Year> | [if target supplied] Target | [if target supplied] % |
|--------|-------------|-----------------------------|------------------------|
| Deals closed | <n> | <target> | <%> |
| Booking revenue | <$> | <$> | <%> |
| Commissions paid | <$> | — | — |

Hidden by zero-denominator rule (omit row entirely):
- Win rate when total_deals_count = 0
- Average sales cycle when total_deals_count = 0
- Average contract value when total_deals_count = 0

## What needs to happen in Q<N+1>

| Prio | Action | Owner | Due | Expected outcome |
|------|--------|-------|-----|------------------|
| P0   | <verb-led action> | <role or name> | <YYYY-MM-DD> | <one line> |
| P1   | ... | ... | ... | ... |
| P2   | ... | ... | ... | ... |

Generation rules:
- Each item is derived from a finding ACTUALLY IN THE DATA (agreement
  unsigned, referral aging by parsed Submitted-On date, deal in late stage
  by stage name alone — see "Stage-age caveat" below). Never generic
  ("nurture the partner"). Never invented signals.
- Priorities: P0 = blocks revenue/activation, P1 = material risk, P2 = hygiene.
- **Owner labels — use these EXACT strings, do not invent names:**
  - `Partner Manager` — anything on the customer (your) side
  - `Partner-side` — anything the partner's team needs to do
  - A real person's name ONLY if the user explicitly provided one
- Due defaults (offsets from period end): P0 = +2 weeks · P1 = +4 weeks · P2 = +8 weeks. Format as `YYYY-MM-DD`.
- Cap at 5 items. If more candidates exist, keep the top 5 by priority + impact.

**Stage-age caveat (Rule against fake aging signals):** the deals tool
returns `last_stage_change_date` as a duration string like `"20599 Days"`
or `"389 Days"` — these are NOT reliable timestamps. Do NOT write "stalled
in stage" / "no movement in N days" / "stale for X" — you do not have
aging data. Limit yourself to what stage name + Amount actually tell you:
"in Demo Scheduled at $10K" is OK; "stalled in Demo Scheduled" is not.

## Pipeline (lifetime)  [CONDITIONAL — omit if `deals.total_items` = 0]

**Open deals** (sorted by Amount descending):
- <Deal name> — $<Amount> — <stage>
- <Deal name> — $<Amount> — <stage>

**Closed-won (lifetime):** <count> deals, $<sum> total. Top: <Deal name> ($<Amount>).
[If test-data heuristic fires — see below — append: "Of these, N appear to be
test/staging entries (e.g. <N> identical-amount records); real Closed Won is
<count> deals worth $<sum>."]

**Closed-lost (lifetime):** <count> deals, $<sum> total.

## Agreements  [CONDITIONAL — omit if no agreements on record]

- <emoji> <agreement Name> — <Status> (signed: <"YYYY-MM-DD" | "unsigned">)
- ...

Emoji map by `Status` string (case-insensitive):
- 🟢 — `Complete`, `Signed`, `Active`, `Executed`, or any status with a non-empty `Signed On`
- 🟡 — `Pending`, `Draft`, `In Review`, `Out for Signature`, or unsigned
- 🔴 — `Expired`, `Terminated`, `Revoked`, `Cancelled`

When the `Status` string doesn't fit any of the above, default to 🟡
and render the raw status. Do NOT invent emoji.

## Referrals (lifetime)  [CONDITIONAL — omit if `total_count` = 0]

<total_count> referrals on record · <p> pending · <a> approved · <r> rejected.
Most recent: <Submitted On as YYYY-MM-DD> — <Referred company name> (<Status>).
Submitted in period: <count by parsing Submitted On strings like "Feb 26, 2026"
into dates and counting those within start_date/end_date>.

If test-looking referrals exist (see Rule 14), append: "N entries appear to
be test submissions (e.g. 'asdf', 'EULER', purely numeric names) — recommend
cleanup."

## Commissions  [CONDITIONAL — omit if empty]

Total paid in Q<N>: $<sum>. <Optional: largest single commission, status breakdown>.

## Invoices  [CONDITIONAL — omit if empty]

<count> invoices, totaling $<sum>. <flag overdue if any>.
```

### What is NOT in the rendered output

The following are diagnostic-only and **must never appear** in the doc
shown to the user:

- Internal IDs (`partner_id`, `deal_id`, agreement id, referral id) — Rule 0
- Source-field annotations like `` `performance.total_deals_count` ``
- Disclaimers about MCP / Bubble / tool limitations
- "DRAFT — partner manager to confirm" caveats (the table format already
  implies these are proposed; no defensive hedging)
- Footer metadata like "Generated by skill vX.Y.Z on YYYY-MM-DD"
- "No X data" placeholder lines (silence the section instead)
- Anything mentioning "the performance tool" or "the deals tool"

## Anti-hallucination rules

These rules are **not optional**. Every QBR must follow them.

0. **NEVER render internal EULER IDs in the output.** The `partner_id`,
   `deal_id`, agreement id, referral id are Bubble-internal opaque
   strings — orchestration-only, never printed. When the MCP adds the
   partner's CRM ID (HubSpot / Salesforce / etc), render that instead.

1. **Empty data → silence the section.** When a tool returns nothing
   for a section, omit the section entirely rather than printing
   placeholders like "No X data". The absence is itself the signal —
   inserting a placeholder line dilutes that signal without adding
   information and clutters the doc. Exception: the TL;DR may name an
   absence in narrative ("no closed deals this quarter") because there
   it is part of the story.

2. **NEVER emit action items that ask the user to debug the system.**
   If `performance.booking_revenue` returns `"$"` while closed-won deals
   exist in `partner_artifacts(deals)`, normalize silently to $0 — do
   NOT produce an action like "Investigate the data discrepancy." Tool
   bugs are an internal problem; they belong in CONTRIBUTING / engineering
   notes, never in the QBR rendered to a partner manager.

3. **NEVER expose system internals to the reader.** No source-field
   annotations (no `` `performance.X` `` columns), no mentions of "the
   performance tool" / "the MCP" / "Bubble" / field names, no
   `<!-- HTML comments -->` in the rendered output. The reader is a
   partner manager preparing for a partner call, not an engineer.

4. **Zero-denominator metric collapse.** If `total_deals_count` for the
   period is 0, OMIT (do not render as zero) the rows for: `win_rate`,
   `sales_cycle`, `avg_contract_value`. These are undefined when no
   deals closed and printing "0.00%" / "0 Days" / "$0" creates false
   precision.

5. **Currency normalization.** Treat `""`, `"$"`, `"$0"`, `"$0.00"` all as
   zero. Display zero as `$0`. Non-zero with thousand separators
   (`$1,234,567`). Percentages as returned (`75.0%`).

6. **Dates vs durations vs strings.** The deals tool returns
   `last_stage_change_date` as a duration string (`"20599 Days"`,
   `"0 Days"`) — attempting to render it as a date produces nonsense
   (we observed years like 4763 when the backend tried to parse such
   inputs). Reserve `YYYY-MM-DD` rendering for strings that successfully
   parse as a real date (`"Jan 1, 2026 5:46 pm"`, `"May 9, 2024"`).
   When in doubt, render verbatim.

7. **Action items must be actionable.** Each row in the action table has
   all 5 columns filled (Prio · Action · Owner · Due · Expected outcome).
   No placeholder TBDs. If you cannot fill all 5 from the data + sensible
   defaults (see Output Format section), drop the row.

8. **Label all-time vs period-filtered in section headings.** The
   period-filtered tools (`performance`, `commissions`) and the
   lifetime tools (`partner_artifacts`, `referrals`) live in the same
   document, and a reader has no way to tell which is which without an
   explicit label. Use Q-period framing for headline sections
   ("What happened in Q1") and the word "lifetime" in pipeline /
   referrals / agreements headings.

9. **Q-over-Q comparison is opt-in.** Default to current-quarter-only.
   If the user explicitly asks for QoQ, fetch both quarters' data and
   compute deltas. (Industry-standard QBRs include QoQ by default;
   we're conservative here because tool-call cost doubles.)

10. **Loose JSON parsing required.** The MCP backend returns stringified
    JSON-like content with known bugs:
    - `referrals(for_partner).result_per_page`: pairs use commas instead
      of colons (`{"id","value"}` not `{"id":"value"}`)
    - `partner_artifacts(agreements).Result[]`: keys have unicode noise
      (`ïd` with diaeresis)
    - Numbers come as strings throughout

    Parse with `Number()` / `parseFloat` / regex before computing.
    If parsing fails, surface as an error — do not guess.

11. **If a tool errors mid-run**, render the rest of the doc normally
    and add a single line at the END (not the top) of the TL;DR:
    > *Note: <section> could not be loaded due to a data fetch error.*
    No giant red banner — the doc must still be presentable.

12. **One partner per invocation.** A QBR is partner-specific by design
    — narratives, action items, and traffic-light status only make
    sense in context of a single partner. If the user asks for a batch
    ("QBR for all my partners"), explain the scope and offer to loop
    the skill once per partner rather than rolling up into a summary.

13. **Tier-conditional narrative.** TL;DR and action items adapt to
    `partner_status`:
    - **Prospecting / Onboarding** → narrative focuses on activation
      milestones (agreements signed, first referral, first deal
      registered). Zero revenue is expected; do not flag as red.
    - **Active** → narrative compares against expected production.
      Zero revenue in period is a red flag. Pipeline coverage matters.
    - **Inactive** → narrative is a reactivate-or-offboard framing.
      Action items skew toward "decide" rather than "execute."

14. **Test-data heuristic — flag, don't filter.** Staging / test entries
    are common in this dataset. Apply these signals (case-insensitive):
    - **Deals**: 5+ Closed Won records at identical Amount (e.g. nine at $100)
    - **Referrals**: company names like `asdf`, `test`, `foo`, `bar`,
      `1234`, purely numeric, or single-word brands matching the customer
      itself (e.g. `EULER` / `Euler` when the customer is Martus)
    - **Agreements**: name fields with placeholder text

    Treatment: keep them in headline counts (transparency), but call them
    out in the relevant section ("N entries appear to be test submissions")
    and add a P2 cleanup action item. Do NOT silently filter — the partner
    manager owns that decision.

15. **No fake aging signals.** The deals tool returns
    `last_stage_change_date` as a duration string (e.g. `"20599 Days"`,
    `"389 Days"`) that is NOT a reliable timestamp. Do NOT write phrases
    like "stalled", "no movement in N days", "stale", "aging out",
    "stuck for X" about any deal. Only assertions backed by parsed date
    strings (e.g. `"Submitted On": "Feb 26, 2026"`) are allowed.

16. **Number formatting context.** The TL;DR is a narrative; rounded
    units read more naturally there (`$87K`, `$1.2M`). Tables and
    detail sections sit next to figures a reader may want to sum or
    spot-check, so use precise formatting with thousand separators
    (`$87,250`, `$1,234,567`). Rounding inside a table creates
    ambiguity about whether the rounding is the underlying number or
    a presentation choice.

## Example user flow

```
User: "Generate a QBR for Axion DataWorks for Q1 2026"

Claude:
1. Reads this skill (generate-qbr playbook)
2. list_accounts → customer self = "Martus" (for header)
3. partners(action: 'list', filter_name: 'Axion DataWorks') →
   partner_id = 1715179138375x527400652689293400
4. performance(action: 'partner', partner_id, '2026-01-01', '2026-03-31') →
   0 deals, $0 booking, $0 billings (period-empty)
5. partner_artifacts(action: 'deals', partner_id) →
   4 all-time deals: Target $500 Won, Best Buy $775 Demo, Honda $3000 Lost, GM $1000 Won
6. commissions(action: 'partner', ...) → empty
7. referrals(action: 'for_partner', partner_id) →
   2 all-time, both May 2024
8. partner_artifacts(action: 'agreements', partner_id) →
   2 pending (MNDA, Tech Partner Agreement)
9. partner_artifacts(action: 'invoices', partner_id) → empty
10. Renders markdown QBR per the template above.

User: copies output → pastes into Slack / Google Doc / email to the partner.
```

## Known limitations (v0.4.0)

Things the skill cannot do today, by tool constraint. Logged for upstream
MCP improvements:

- **No partner CRM ID exposed.** Customer-side tools return the
  EULER-internal `partner_id` only. Partner managers want the CRM ID
  (HubSpot / Salesforce / Pipedrive object id) in their QBR. Pending
  upstream MCP change — once added to `partners(list)`, `list_accounts`,
  and `performance(partner)` responses, surface it in the header.
  Assigned: Marcelo (Bubble-side).
- **No period filter for deals / referrals / agreements / invoices.** Listed
  as all-time. Workaround: parse `"Submitted On"` for referrals and
  approximate.
- **No `closed_on` date in deals.** `last_stage_change_date` is a duration,
  not a timestamp.
- **No `expires_on` for agreements.** Cannot surface renewal risk.
- **No Sourced/Influenced/Delivered split** in `performance`. The MCP tool
  `influenced_sourced_deals` exists and could be added in a future version.
- **No MDF / incentives data.** `incentives_summary` exists; future
  enhancement.
- **Q-over-Q comparison** not built-in. Roadmap v0.3.

## Why this skill exists

A QBR currently takes a partner manager 1–2 hours per partner per quarter —
opening 5 different tools, copying numbers into a deck, formatting tables by
hand. With this skill the same output is one prompt + a few seconds of tool
orchestration. At scale (a customer with 14 partners × 4 quarters = 56 QBRs
per year), the time saved is in the dozens of hours.
