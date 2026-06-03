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
| 9 | `influenced_sourced_deals(partner_id, start_date, end_date)` | Deal-attribution split (Sourced vs Influenced vs Sourced-and-Influenced). Critical for tier conversations — partners want credit for the deals they touched, not just the ones they originated. |
| 10 | `partners(action: 'summary')` | Company-wide context for anchoring: total partner count, status distribution. Used in the TL;DR ("one of only N partners in <status>"). |
| 11 | `performance(action: 'partner', partner_id, prev_quarter_dates)` | Previous quarter for Q-over-Q deltas (see "Q-over-Q rules" below). |
| 12 | `performance(action: 'partner', partner_id, quarter_-2/-3/-4_dates)` | Up to 4 additional historical quarters for quarter-over-quarter trend context (rendered as deltas in the hero `.fact-sub` / spotlight prose — the modern template has no sparklines). Skip if user explicitly asks for a fast/lite QBR. |

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

Render a **single self-contained HTML file** — no external CSS, no
external fonts, no script tags. A partner manager should be able to
open it in a browser, paste it into email, save as PDF, or share by
link, all from the same artifact.

The document is **executive-readable**: skimmed in 30 seconds, drilled
into in 2 minutes. No internal field paths, no system terminology.

### How to produce the HTML

1. Read [`assets/styles.css`](assets/styles.css) and inline its full
   contents into a single `<style>` block in `<head>`. Do not link to
   the file — self-contained is required for portability.
2. Use the structural template in [`assets/template.html`](assets/template.html)
   as the skeleton. Fill in data; do not invent class names that
   aren't defined in the stylesheet.
3. Model output is the complete HTML — `<!DOCTYPE html>` through
   `</html>`. No surrounding markdown, no preamble.

Sections marked **CONDITIONAL** are omitted entirely when their
underlying data is empty. Do not print "No X data" placeholders —
silence the section.

## Partner health score (computed — see the shared model)

Compute the partner's health per [`docs/partner-health-model.md`](../../docs/partner-health-model.md)
in **full** mode (all 5 factors — you already fetch every source in the Orchestration sequence, so
this adds no extra calls). Produce: a **score 0–100**, a **band** (Healthy / Watch / At-risk /
Ramping), the **factor breakdown** (each factor's normalized value × weight = contribution), and
the **reason** (the 2–3 factors driving the score, plus any cap that fired).

Render:
- **Hero:** the score + band. Band → tone (per the model's tone mapping): At-risk → `red`,
  Watch → `amber`, Healthy / Ramping → default (brand). Show the band in the `hero-eyebrow`.
- **Spotlight:** the breakdown as the "why" — e.g. "Production 28/35 · Recency 3/10 (last
  activity 41d ago)" — and name any cap ("capped at Watch: 0 closed deals in Q1").

This replaces the old green/amber/red heuristic — `band` is now the single, model-consistent signal.

### Euler design system (modern report treatment)

Output follows the **Euler design system** in a modern, landing-page-style layout
(identical to `portfolio-pulse` and `pending-approvals-triage`): sticky **topbar**
with the Euler **text wordmark** → **hero** (eyebrow chip + headline with a gradient
`.accent` span + `.quick-facts` headline metrics) → **spotlight** gradient panel for
the TL;DR → numbered sections (`.section-eyebrow` "01 · …") with `.table-wrap` tables,
`.quick-facts` stat clusters, and `.dist` chips → footer.

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>`
in the topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer.
Do NOT use an `<img>` logo — the remote brand SVG renders broken in Claude's artifact
viewer. Keep the two `<link rel="preconnect">` tags.

**Lightweight & mobile-responsive (required).** No JavaScript, no images, no base64
blobs, no extra web fonts beyond the two the stylesheet `@import`s. The sheet already
handles responsiveness (fluid `clamp()` type; tables scroll on narrow screens). Do not
add fixed pixel widths or inline `<style>` beyond inlining the provided sheet. Cap
repeated rows (top-5 open deals, ≤5 action items).

**Tone classes follow the health band.** `.hero-eyebrow` and `.spotlight` take
`amber`/`red` (or default brand) to match the partner's computed band (At-risk →
`red`, Watch → `amber`, Healthy / Ramping → default brand).

### Required structure (component → meaning)

Follow [`assets/template.html`](assets/template.html). Sections, in order. Use ONLY
class names defined in the stylesheet — never improvise colors, fonts, or classes.

1. **Topbar** — `brand-mark` "Euler" + `brand-label` "Q{N} {Year} Review · {Partner}".
2. **Hero** — `hero-eyebrow` (tone) "{Q period} · {health band}" (the band from the health
   model, tone-matched per above); `<h1>` "{Partner} — <span class="accent">Q{N} {Year}</span>";
   subtitle = the one-line state + a `.data-pill` (complete/partial/stale).
3. **Quick facts** (`.quick-facts` → `.fact`): period headline metrics — Closed-won
   (Q{N}), Deals closed, Win rate, Commissions paid. **Zero-denominator collapse**
   (Rule 4): when 0 deals closed in the period, OMIT the Win rate fact entirely
   (don't render "0.00%"). Numerals render mono via `.fact-value`.
4. **Spotlight** (`.spotlight` tone) — the TL;DR + the health "why". `<h2>` one-line state;
   `<p>` 2–3 sentences (biggest signal · biggest risk · the number that matters) plus the
   health breakdown (the 2–3 driving factors, e.g. "Production 28/35 · Recency 3/10") and any
   cap that fired, ending with `<strong>Recommended next step:</strong> {one focused action}`.
   Wrap key figures in `<span class="num">`.
5. **01 · Next quarter** (action items): `.table-wrap` table — Prio (`status-pill`
   red=P0 / amber=P1 / gray=P2) · Action (`<strong>` + `.cell-note` expected outcome)
   · Owner · Due (numeric, `YYYY-MM-DD`). Cap 5 rows, sorted by priority.
6. **02 · Pipeline (lifetime)**: a `.quick-facts` cluster (Open deals, Closed-won
   lifetime, Avg deal size — omit a Closed-lost fact if $0) + a `.table-wrap` of the
   **top 5 open deals** by Amount (Deal · Stage · Amount). `.note` for the rollup
   ("+ N more open deals under $1K (…)"). **Omit the whole section if no deals.**
7. **03 · Attribution** (`.dist` chips): Sourced / Influenced / Sourced & influenced,
   from `influenced_sourced_deals`. **Omit if no attribution data.**
8. **04 · Agreements**: `.table-wrap` — Status (`status-pill` 🟢/🟡/🔴) · Agreement ·
   Signed (numeric date or "—"). **Omit if none.**
9. **05 · Referrals (lifetime)**: `.quick-facts` (Total submitted, In Q{N}, Most
   recent) + `.note` (most-recent detail + test-data note if applicable). **Omit if
   none.**
10. **06 · Commissions** — `.note` prose ("Total paid in Q{N}: $X …"). **CONDITIONAL:
    omit the whole section if empty.**
11. **07 · Invoices** — `.note` prose ("N invoices, $X total …"). **CONDITIONAL: omit
    if empty.**
12. **Footer** — `brand-mark footer-mark` "Euler" + "Q{N} {Year} Business Review ·
    {Partner}" + `.mono` "euler · generate-qbr".

Model output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding
markdown, no preamble.

### Health band labels (QBR vocabulary)

The pill label IS the band from [`docs/partner-health-model.md`](../../docs/partner-health-model.md).
Use the band as the `status-pill` text; tone follows the model's mapping.

| `status-pill` tone | Pill label | Band (from the health model) |
|--------------------|-----------|------------------------------|
| (default brand) | `Healthy` | score ≥ 70 |
| `amber` | `Watch` | 40 ≤ score < 70 (or a cap that fires Watch) |
| `red` | `At-risk` | score < 40, or `status = Inactive` (cap → At-risk) |
| (default brand) | `Ramping` | status ∈ {Onboarding, Prospecting} |

Write the pill label as the band name (`Healthy` / `Watch` / `At-risk` / `Ramping`) —
never the internal tone word (`amber`, `red`). The band tells the reader what the
state MEANS.

### Action item generation rules
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

### Agreement emoji map (`Status` string, case-insensitive)

- 🟢 — `Complete`, `Signed`, `Active`, `Executed`, or any non-empty `Signed On`
- 🟡 — `Pending`, `Draft`, `In Review`, `Out for Signature`, or unsigned
- 🔴 — `Expired`, `Terminated`, `Revoked`, `Cancelled`
- Unknown statuses default to 🟡, with the raw status text rendered next to it.

### Pipeline section rules

- Show **top 5 open deals** by Amount descending — never the full list.
  When there are more, append a `<p class="note">` summarizing the
  rollup (e.g. *"+ 5 more open deals under $1K (Names...)"*).
- Closed-won stat card shows total; if test-data heuristic fires (Rule 14),
  add a `.fact-sub` on the Closed-won fact like *"7 real deals · 4 test entries excluded ($699)"*.
- Closed-lost stat card: **omit entirely if $0** (Rule 1).

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
    — narratives, action items, and the health band only make
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

15. **Aging signals — bounded by data quality.** `last_stage_change_date`
    on deals comes back as a duration string. The backend has a sentinel
    placeholder for "unknown" — values **≥ 9999 Days** (typically `"20599 Days"`,
    which is 56+ years) are the null/garbage value and must NOT be used.
    Values **< 9999 Days** ARE real elapsed-time signals and can be used:
    - "Acme has been in Stage 1 for 493 days — push or disqualify"
    - "Everest closed-won 19 days ago"
    - "lucas test no movement in 355 days"

    Same threshold applies anywhere we see a duration string from this
    backend. The threshold exists because the dataset has a sentinel
    value (~20599 days = epoch artifact); without filtering, any aging
    claim would silently include garbage. With the threshold, aging is
    a legitimate signal.

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

User: opens the HTML in a browser → saves as PDF, or copies the rendered
page into an email / Google Doc to send to the partner. (To share in Slack,
attach the file or a link — pasting raw HTML into Slack does not render.)
```

## v0.8 output enhancements

[`references/output-enhancements.md`](references/output-enhancements.md) has the
detailed rules for Q-over-Q, the Impact line, and the data-confidence indicator.

> **Note:** that reference predates the modern template. Its old class names
> (`.impact` spans, stat-card inline-SVG sparklines) are **superseded** by the
> component mapping below. Apply this mapping, not the old class names.

- **Q-over-Q (opt-in):** fetch current + prev quarter via `performance`; render the
  delta as text in the relevant hero `.fact-sub` (e.g. "↑ +12% vs Q3") and/or in the
  spotlight prose. No separate column. Omit `0 → 0`.
- **Sparklines:** **dropped** in the modern template — the `.fact` cards don't host
  inline charts. Use the Q-over-Q delta text instead. (Revisit only if a charting
  component is added to the design system.)
- **Impact:** every action row's `.cell-note` (in the `01 · Next quarter` table)
  cites concrete numbers from the data ("$50K stalled deal", "7 referrals × $15K avg
  ACV"). Never invented. This replaces the old `.impact` span.
- **Data confidence pill:** the `.data-pill` (`complete` / `partial` / `stale`) in the
  hero subtitle, indicating fetch completeness.

## Why this skill exists

A QBR currently takes a partner manager 1–2 hours per partner per quarter —
opening 5 different tools, copying numbers into a deck, formatting tables
by hand. With this skill the same output is one prompt + a few seconds of
tool orchestration. At scale (14 partners × 4 quarters = 56 QBRs/year),
the time saved is in the dozens of hours.
