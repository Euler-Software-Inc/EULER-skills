---
name: portfolio-pulse
description: Generate a one-screen pulse of a customer's entire partner portfolio — totals, top performers, who needs attention, and coverage gaps — using EULER MCP tools. Use this skill whenever a partner manager wants a portfolio-wide read across ALL their partners — phrases like "how is my partner portfolio doing", "show me my top partners", "partner leaderboard", "which partners need attention", "portfolio overview", "book of business", or any company-wide partner roll-up, as opposed to a single-partner review (that is generate-qbr).
---

# Portfolio Pulse — one-screen read of the whole partner portfolio

## When to use this skill

Invoke when the user wants a **portfolio-wide** view across ALL their partners:

- "How's my partner portfolio doing?"
- "Show me my top partners / partner leaderboard / best performers"
- "Which partners need attention?"
- "Portfolio overview / book of business / partner pulse"
- `/euler:portfolio-pulse`

DO NOT invoke for:

- **A single partner** — use `generate-qbr` (deep retrospective) or `partner-briefing` (pre-call prep).
- **Your own company's aggregate only** — use `performance(action: 'company')` directly.

The distinction: portfolio-pulse is the **multi-partner roll-up** that QBR and
briefing deliberately refuse. It ranks and segments the whole book; it does NOT
go deep on any one partner (it deep-links to `generate-qbr` for that).

## Account type — required: customer admin

This skill is for **customer admins / partner managers** (the company that hosts
the partner program). It is NOT usable from a partner-only account.

**Step 1 is always `list_accounts`.** Apply the account gate in
[`references/account-gate.md`](references/account-gate.md) before anything else:

- Connected account has a `type === 'customer'` entry → proceed (customer context).
- Partner-only connection → emit the friendly gate message and STOP (do not
  proceed into a scope error). Suggest `my-performance` + the partner dashboard URL.

## Inputs (all optional — never block on them)

### 1. Time window
- Default: **last 90 days** (today − 90 → today).
- Accept: "this quarter", "last 30 days", "Q1 2026", explicit dates, "YTD".
- Convert to `start_date` / `end_date` in **`YYYY-MM-DD`** (never a time component —
  full ISO datetimes are mis-parsed downstream).

### 2. Ranking metric
- Default: **`revenue`** (closed-won deal revenue).
- "by deals" / "most wins" → `entity_key: 'deals'`.

### 3. Top N
- Default **10** (`limit: 10`). "top 5" → `limit: 5`.

No partner is named — this is the entire portfolio.

## Orchestration sequence (~5 fixed calls, no per-partner loop)

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Customer-side `name` (header) + account gate. |
| 2 | `partners(action: 'summary')` | Company-wide partner count + status distribution. |
| 3 | `performance(action: 'company', start_date, end_date)` | Own-company aggregate (sales / deals / charges) for portfolio totals. |
| 4 | `performance(action: 'overall', entity_key, start_date, end_date, page: 1, limit: N)` | **Terminal** ranked top-N partners + aggregate metrics in one call. Won deals only, no commissions. |
| 5 | `partners(action: 'list', page: 1, limit: 100)` | Roster (name + status) to derive the at-risk segment. Page if needed; note if truncated. |

`overall` is terminal — it returns ranking + aggregates together; do NOT loop
per-partner `partner_artifacts`/`commissions` for a pulse. If the user wants depth
on one partner, suggest `/euler:generate-qbr <partner>`.

For exact response field paths per tool, consult
[`references/mcp-field-paths.md`](references/mcp-field-paths.md). The same backend
gotchas apply (dates `YYYY-MM-DD`; numerics arrive as strings; loose JSON parsing).

### Error handling
- Partner-only account → gate message (see §Account type), STOP.
- `backend_data_issue` on `list_accounts` → surface its `support_email`; continue
  with whatever the other company-scope tools return.
- `forbidden_scope` escaping mid-run → translate via `references/account-gate.md`
  into the friendly message; never surface the raw code.
- Any single tool empty/errors → continue; add a one-line footnote at the END of
  the TL;DR naming the missing section. No giant banner.

## Segmentation (cheap signals only — no per-partner deep fetch)

- **Portfolio totals** (summary + company): partner count, status mix, revenue/deals
  in window.
- **Top performers** (overall): top N by the chosen metric, with deal count.
- **Needs attention** (from `partners(list)` status + ranking absence):
  - `Inactive` partners → reactivate-or-offboard.
  - `Active` partners with zero production in the window (active but absent from the
    won ranking / zero revenue).
  - A large `Onboarding`/`Prospecting` cohort → activation backlog.
  - Each row: status pill + name + reason (from the cheap signal) + one action +
    deep-link ("run `/euler:generate-qbr` for <partner>").
- **Coverage gaps**: producing vs dormant share; concentration (top partner = X% of
  ranked revenue → concentration risk).
  - Producing count precision depends on `overall`'s response (whether it returns a
    total/all-producers count or only the top-N page). If only top-N, label as
    "top-N producing" rather than implying the full book. Never overstate.

## Output format

Render a **single self-contained HTML file** — no external CSS/fonts/scripts.
Opens in a browser, prints to PDF, or shares by file/link (email, Notion, Slack).
Note: pasting raw HTML into Slack does not render — share the file or a link.

### Euler design system
Output follows the **Euler design system**. Read [`assets/styles.css`](assets/styles.css)
and inline its full contents into a single `<style>` block in `<head>` (self-contained,
required). It already encodes the tokens — Inter 400–700, Brand-600 `#2563EB`,
two-layer shadows, radius-md tables / radius-xl cards / radius-full pills. Use ONLY
class names defined in that stylesheet; never improvise colors or fonts. Use the
skeleton in [`assets/template.html`](assets/template.html). Model output is the
complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding markdown.

### Required structure (class → meaning; component → design-system)

```
<div class="container">                            <!-- card, Brand-600 accent stripe -->
  <div class="header">
    <h1>Portfolio Pulse — <Customer></h1>
    <div class="meta">
      <span class="data-pill {complete|partial|stale}">…</span>
      · Window: {start} to {end} · {N} partners
    </div>
  </div>

  <div class="tldr {green|amber|red}">            <!-- Alert/Callout: state -->
    <p class="tldr-headline">{portfolio state + the number that matters}</p>
    <p class="tldr-body">{biggest signal + biggest risk}</p>
  </div>

  <h2>Portfolio at a glance</h2>                   <!-- Stats/Widgets -->
  <div class="stats-grid cols-4"> …total partners · active · producing (window) ·
       revenue (window) · top-partner concentration… </div>

  <h2>Top performers</h2>                          <!-- Table (compact) -->
  <table><thead><tr><th>#</th><th>Partner</th><th>Revenue</th><th>Deals</th></tr></thead>
    <tbody> …top N; rank #1 may use a Brand-600 accent… </tbody></table>

  <h2>Needs attention</h2>                          <!-- List Item + Status -->
  <div class="row">
    <span class="row-name"><span class="status-pill {red|amber|gray}">{emoji} {label}</span> {Partner}</span>
    <span class="row-meta">{reason} · {one action}</span>
  </div>
  …cap at ~6 rows, top by severity…

  <h2>Status distribution</h2>                      <!-- Status pills + counts -->
  <p class="section-prose">Active N · Onboarding N · Prospecting N · Inactive N</p>
</div>
```

### Status pill vocabulary (portfolio)
| Emoji | Pill | Meaning |
|-------|------|---------|
| 🟢 | `Producing` | closed-won revenue in the window |
| 🟡 | `Watch` | active, no production in window, OR onboarding/prospecting |
| 🔴 | `At risk` | active + zero lifetime-visible production, or inactive blockers |
| ⚪ | `Inactive` | `status = Inactive` |

Do not print internal labels like `amber` — the semantic label tells the reader what
the colour means.

### Section omission
Silence empty sections (no "No X data" placeholders). The absence is the signal.

## Anti-hallucination rules (not optional)

0. **No internal IDs** in output (`partner_id`, deal_id, etc.) — orchestration only.
1. **`overall` ranks by closed-won deals only — NO commissions.** Label revenue as
   "closed-won revenue (window)". Never conflate with commissions or invoices.
2. **At-risk reasons limited to cheap signals** (status + zero-production in window).
   NO "stalled N days" / aging claims — portfolio-pulse has no per-partner aging data.
3. **Label window-filtered vs current-state.** `overall`/`company` are window-filtered;
   `summary`/`list` are current state. Don't imply a status count is "this quarter".
4. **Currency normalization.** `""`/`"$"`/`"$0"` → `$0`; thousand separators on non-zero.
5. **Numerics arrive as strings** — `Number()`/`parseFloat` before computing/sorting.
6. **Loose JSON parsing** — `partners(list)`/`summary` may return stringified arrays;
   parse defensively. If parsing fails, surface an error — don't guess.
7. **Producing-count honesty** — if `overall` only returns the top-N page, do not
   present a full-portfolio "X% producing" as if you saw every partner; scope the claim.
8. **Test-data heuristic — flag, don't filter.** Placeholder partner names (`test`,
   `asdf`, numeric-only, the customer's own name) are likely test entries; note them,
   keep them in counts.
9. **No system internals in output** — no tool names, no "the performance tool", no
   field paths, no `forbidden_scope`/`euler_*` codes shown to the user.
10. **One portfolio per invocation** for the connected customer. If the user has
    multiple customer accounts, ask which one (rare).

## Example user flow

```
User: "How's my partner portfolio doing this quarter?"

Claude:
1. Reads this skill.
2. list_accounts → customer self = "Martus" (header) + gate passes (customer role).
3. partners(action: 'summary') → 42 partners: 18 Active, 9 Onboarding, 7 Prospecting, 8 Inactive.
4. performance(action: 'company', '2026-04-01', '2026-06-30') → company aggregate.
5. performance(action: 'overall', entity_key: 'revenue', dates, page: 1, limit: 10) →
   ranked top 10 partners by closed-won revenue + aggregates.
6. partners(action: 'list') → roster → derive: 8 inactive, 5 active-zero-production.
7. Renders the portfolio-pulse HTML per the template.

User: opens the HTML in a browser / saves as PDF. Deep-links into generate-qbr for
the two partners flagged "Needs attention".
```

## Why this skill exists

A partner manager with 40+ partners has no fast portfolio-wide read today — they'd
open the dashboard, eyeball rankings, and manually spot dormant partners. QBR and
briefing are deliberately per-partner. portfolio-pulse fills the gap: one prompt →
a one-screen pulse that surfaces the few partners worth a deeper QBR, in seconds.
