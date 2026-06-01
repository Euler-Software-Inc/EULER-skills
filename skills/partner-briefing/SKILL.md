---
name: partner-briefing
description: Generate a pre-meeting briefing about a specific partner — 30-second read with what they'll want to discuss, what you should bring up, and key stats from the last 30 days. Use this skill whenever the user mentions a partner call, partner meeting, pre-call prep, partner briefing, or asks "what should I know before I talk to a partner", "prep me for my call with this partner", or "give me a quick read on a partner" — even when the word "briefing" isn't used.
---

# Partner Briefing — Pre-meeting prep for a partner call

## When to use this skill

Invoke whenever the user types something like:

- "Briefing on <partner>"
- "Prep me for my call with <partner>"
- "What should I know before I meet <partner>?"
- "Give me a quick read on <partner>"
- "I have a call with <partner> in 30 minutes"
- `/euler:partner-briefing`

DO NOT invoke for:

- **Quarterly retrospectives** — use `generate-qbr` instead (different audience, different format, longer doc).
- **Multi-partner overviews** — this skill is per-partner.
- **Company-wide reviews** — use `performance(action: 'company')` directly.

The distinction that matters: a briefing is **forward-looking** (what to walk into a meeting knowing). A QBR is **backward-looking** (what happened last quarter, shareable doc). If the user wants to *send something to the partner*, route to QBR. If they want *internal prep before talking to them*, this skill.

## Inputs needed from user

### 1. Which partner?

Same resolution as `generate-qbr`:

1. `list_accounts` if the user has an account with that partner.
2. Otherwise `partners(action: 'list', filter_name: '<name>')` and match
   on `"Partner name"` (case-insensitive substring).
3. If multiple matches, list with `status` and ask the user to pick.

### 2. (Optional) Lookback window

Default: **last 30 days from today**.

Accept variants: `"last week"` (7 days), `"last 2 weeks"`, `"last month"`,
`"since last meeting"` (treat as 30 days unless user specifies a date),
`"since <YYYY-MM-DD>"`. Render dates in `YYYY-MM-DD` format when calling
the MCP.

### 3. (Optional) Meeting context

A short tag like `"renewal call"`, `"QBR call"`, `"first intro"`,
`"escalation"`. If supplied, it reshapes the "What they'll likely want to
talk about" section. If not supplied, do not ask — generic framing is the
default.

## Orchestration sequence

Same 6 MCP tools as `generate-qbr`, just with a 30-day window by default
instead of a quarter. Skip steps only if the user's framing excludes them
(e.g. "skip pipeline, just the agreements").

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Customer-side name (rarely rendered in briefing — internal prep doesn't need a doc header) |
| 2 | `partners(action: 'list', filter_name: '<name>')` | Resolves `partner_id`. Skip if user provided one. |
| 3 | `performance(action: 'partner', partner_id, start_date, end_date)` | Headline movement in the window |
| 4 | `partner_artifacts(action: 'deals', partner_id, page: 1, limit: 20)` | All-time pipeline — used for "what they'll want to discuss" + "what you should bring up" |
| 5 | `commissions(action: 'partner', partner_id, start_date, end_date)` | Recent commission events |
| 6 | `referrals(action: 'for_partner', partner_id, page: 1, limit: 20)` | All-time referrals; filter to the window by parsing `"Submitted On"` |
| 7 | `partner_artifacts(action: 'agreements', partner_id)` | Open agreement blockers |
| 8 | `influenced_sourced_deals(partner_id, start_date, end_date)` | Sourced vs Influenced split for the window. Adds depth to "what they'll want to talk about" — partners commonly raise attribution disputes. |
| 9 | `performance(action: 'partner', partner_id, prev_window_dates)` | Previous window (e.g. 30 days before the current 30-day window) for delta indicators in stat cards. |

For exact field paths per tool, consult
[`references/mcp-field-paths.md`](references/mcp-field-paths.md).
The same backend serves this skill and `generate-qbr`; the same gotchas
apply (date format `YYYY-MM-DD` for `performance`, `last_stage_change_date`
is a duration not a timestamp, JSON serialization bugs on
`referrals(for_partner)`).

### Error handling

Inherits from `generate-qbr`: `partner_not_in_consent` → abort with reconnect
instructions; tool errors mid-run → render the rest and add a footnote.
A briefing is short, so if any single tool fails, a footnote is fine —
don't add a giant red banner.

## Status traffic light (briefing variant — 30-day window)

The same emoji vocabulary as QBR, but the conditions are tuned for a
shorter window:

| Indicator | Conditions |
|-----------|------------|
| ⚪ **Inactive** | `partner_status` = "Inactive" — meeting is likely reactivate-or-offboard |
| 🟢 **Hot** | Any of these in the window: ≥1 closed-won deal, ≥1 referral approved, ≥1 agreement signed, or commission paid |
| 🟡 **Steady** | Default — activity in flight (open pipeline, pending referrals, in-progress agreements) but no closes in window |
| 🔴 **Cold / blocked** | `partner_status` = "Active" AND zero window activity AND foundational blocker present (unsigned agreement, stuck referrals, no open pipeline) |

The traffic light is the most important single signal — the partner
manager glances at it before reading anything else.

## Output format

Render a **single self-contained HTML file** — no external CSS, no
external fonts, no script tags. The user opens it in a browser, prints
to PDF, or shares the file / link (email, Notion, Slack). Note: pasting
raw HTML into Slack does not render — share the file or a link instead.
Portability across these targets demands a self-contained artifact.

**Target length:** ~200 words of body content. The point is 30-second
readability before walking into a call.

### How to produce the HTML

1. Read [`assets/styles.css`](assets/styles.css) and inline its full
   contents into a single `<style>` block in `<head>`. Do not link to
   the file — self-contained is the whole point.
2. Use the structural template in [`assets/template.html`](assets/template.html)
   as the skeleton. Fill in the data; never invent classes that aren't
   defined in the stylesheet.
3. The model output is the complete HTML — `<!DOCTYPE html>` through
   `</html>`. No surrounding markdown, no explanation, no headers.

### Required structure (HTML class names → meaning)

```
<div class="container">
  <div class="header">
    <h1>🎯 Briefing: <Partner name></h1>
    <div class="meta">
      <span class="status-pill {green|amber|red|gray}">{emoji} {label}</span>
      · Prepared <YYYY-MM-DD>
      · Status: <partner_status>
    </div>
  </div>

  <div class="tldr {green|amber|red|gray}">
    <p class="tldr-headline">{one-line state, with the most important number embedded}</p>
    <p class="tldr-cta">{one sentence — what they'll push on / what you should lead with}</p>
  </div>

  <h2>What they'll likely want to talk about</h2>
  <ul>...max 3 bullets...</ul>

  <h2>What you should bring up</h2>
  <ul>...max 3 bullets...</ul>

  <h2>Quick stats (last <N> days)</h2>
  <div class="stats-grid cols-4">
    <div class="stat">
      <div class="stat-label">{label}</div>
      <div class="stat-value">{value}</div>
      <div class="stat-sub">{sub-detail, optional}</div>
    </div>
    ...
  </div>

  <h2>Recent touchpoints</h2>
  <div class="row">
    <span class="row-name">{type}</span>
    <span class="row-meta">{date — name (status)}</span>
  </div>
  ...
</div>
```

### Status-pill labels (briefing variant — 30-day window)

| Emoji | Pill label | Meaning |
|-------|-----------|---------|
| 🟢 | `Hot` | Movement positive in the window (close-won, referral approved, agreement signed, commission paid) |
| 🟡 | `Steady` | In-flight activity (open pipeline, pending referrals, in-progress agreements) but no closes in window |
| 🔴 | `Cold` | Active partner + zero window activity + foundational blocker |
| ⚪ | `Inactive` | `partner_status = "Inactive"` — reactivate-or-offboard framing |

### Section omission rules

Briefings are short; empty sections kill the format. Omit:

- **"Quick stats" stat cards** that are zero — omit the whole card (don't render "Closed-won: $0")
- **"Recent touchpoints" rows** when the underlying entity has no parseable date
- **The entire "Recent touchpoints" section** if both rows would be omitted
- **The "What you should bring up" section** if you cannot derive at least one item from data (rare — usually there's an unsigned agreement or pending referral)

### What is NOT in the output

Same exclusions as QBR:

- Internal IDs (`partner_id`, `deal_id`, agreement id, referral id)
- Source-field annotations
- Disclaimers about MCP / Bubble / tool limitations
- Footer metadata like "Generated by skill v..."
- "No X data" placeholder lines (silence the row/section)

## Anti-hallucination rules

These rules are not optional. Many are inherited from `generate-qbr` —
the same MCP, the same data quirks, the same audience-protection
concerns. Briefing-specific additions are flagged with [BRIEFING].

0. **NEVER render internal EULER IDs in the output** (inherited from
   QBR Rule 0). Briefings are internal-only documents, but the partner
   manager copies them into Slack — and Slack messages drift outward.

1. **Silence empty sections** rather than printing "No X data"
   placeholders. The absence is itself a signal; a placeholder line
   dilutes the 30-second readability that is the point of a briefing.

2. **NEVER expose system internals** (inherited from QBR Rule 3). No
   `performance.X` references, no "the deals tool returned", no field
   paths visible.

3. **"What they'll likely want to talk about" must derive from actual
   data, not generic templates** [BRIEFING]. Avoid items like
   "they probably want to discuss the partnership" — that's empty
   filler. Each item must trace back to a specific record: an
   agreement in `Pending`, a referral pending review, a deal in a
   late stage, a recent commission. If you cannot derive at least one
   item from the data, the section may be omitted entirely.

4. **"What you should bring up" must be actionable for the
   partner-manager** [BRIEFING] — not requests for the partner to do
   things, and not action items about debugging the tool. Examples:
   - Good: "MNDA has been pending signature for X days — ask if there's
     a legal blocker"
   - Good: "Sierra referral hit a CRM write error — needs your manual
     entry"
   - Bad: "investigate why the performance tool returns 0"
   - Bad: "the partner should send more referrals" (that's the
     partner's job, not yours)

5. **Aging signals — bounded by data quality** (inherited from QBR
   Rule 15, refined v0.8.0). `last_stage_change_date` is a duration
   string. Values **≥ 9999 Days** (e.g. `"20599 Days"`) are the
   sentinel/null garbage — never use. Values **< 9999 Days**
   (e.g. `"19 Days"`, `"389 Days"`, `"942 Days"`) ARE real aging
   signals and can be cited: *"Everest closed-won 19 days ago"*,
   *"Best Buy in Demo Scheduled for 493 days — push or disqualify"*.
   For referrals, `"Submitted On"` is a real date and aging is
   straightforwardly derivable.

6. **Currency normalization** (inherited from QBR Rule 5). Treat `""`,
   `"$"`, `"$0"`, `"$0.00"` all as zero. Display zero as omitted (per
   Rule 1) or as `$0` only when the row is contextually material.

7. **Tier-conditional framing** (inherited from QBR Rule 13). The
   "What they'll likely want to talk about" inference adapts to
   `partner_status`:
   - **Prospecting / Onboarding** → topics skew toward activation
     (first referral, first deal, foundational agreements)
   - **Active** → topics skew toward production (pipeline, recent
     closes, commission expectations)
   - **Inactive** → topics are framed as reactivate-or-offboard,
     not operational

8. **Meeting-context shaping** [BRIEFING]. If the user supplied a
   meeting context tag, weight the "What they'll likely want to talk
   about" section toward that context:
   - `"renewal call"` → agreement expirations (note: we don't have
     expiration dates today; surface signed agreements at risk by age)
   - `"QBR call"` → quarter-level numbers, point user to running
     `generate-qbr` instead
   - `"first intro"` → minimal data assumed; briefing focuses on
     partner status + any agreements on file
   - `"escalation"` → blockers, rejected items, stuck states

9. **Cap each section at 3 bullets.** A briefing that runs to 10
   bullets is no longer a briefing. If you have more than 3 candidate
   items, keep the top 3 by impact (foundational blockers > stuck
   process > hygiene).

## Example user flow

```
User: "I have a call with Lumon Industries in 30 minutes — prep me"

Claude:
1. Reads this skill (partner-briefing playbook)
2. partners(action: 'list', filter_name: 'Lumon Industries') →
   partner_id = 1715179138376x577819007342954800
3. performance(action: 'partner', partner_id, '2026-04-25', '2026-05-25')
4. partner_artifacts(action: 'deals', partner_id) → 19 deals lifetime
5. commissions(action: 'partner', ...) → empty for the window
6. referrals(action: 'for_partner', partner_id) → 18 lifetime, 7 in
   the last 30 days (heavy referral activity from April)
7. partner_artifacts(action: 'agreements', partner_id) → 3 Complete + 2 Pending
8. Renders briefing markdown per the template.

User: opens the HTML in a browser (or saves as PDF) to skim before the call.
```

## Vs-previous-window delta (default-on as of v0.8.0)

Stat cards show a small `↑ +12%` / `↓ −5%` / `→ no change` indicator
below the stat value (or inline) when the current-window value differs
materially from the previous equivalent window. Same delta-rendering
rule as QBR.

When the current window has zero activity and the previous also had
zero, omit the delta — the absence is the signal, no need for a
"→ no change" pill.

## Impact context on "What you should bring up" (default-on as of v0.8.0)

Each bullet in "What you should bring up" should embed a concrete impact
phrase when one is derivable from data:

- *"Sign MNDA — currently blocks $50K Acme deal from advancing"*
- *"Triage 7 pending referrals — ~$105K potential pipeline awaiting your decision"*

The phrasing differs slightly from QBR's Impact column because briefing
bullets are conversational, not table cells. Apply the same
"derived from real data, never invented" discipline.

## Data confidence indicator (default-on as of v0.8.0)

Same as QBR — add a `<span class="data-pill ...">` next to the status
pill summarizing fetch completeness (complete / partial / stale).
Briefings are short, so a partial-data badge is even more important —
the reader needs to know if commissions or referrals data was
unavailable before walking into the meeting.

## Known limitations (v0.8.0)

- **No `since last meeting`** without a date — we don't have meeting
  history. Treat as 30 days unless user supplies a date.
- **No call notes / transcript ingestion.** Introw's briefing supports
  this; ours doesn't. Future enhancement once a call-notes tool lands
  in the MCP.
- **No calendar / next-meeting lookup.** A briefing must be triggered
  by the user; we don't proactively detect upcoming meetings.
- **Pre-meeting briefing is per-partner only.** Batch ("brief me on all
  my calls today") would need calendar integration.

## Why this skill exists

A partner manager runs 5–10 partner calls per week. Pre-call prep
today means opening the EULER dashboard + the CRM + Slack history +
the agreement folder, one partner at a time. This skill compresses
that to one prompt + a 30-second read. At 8 calls/week × 5 min saved
per call × 50 weeks/year = 33 hours saved per partner manager per
year.
