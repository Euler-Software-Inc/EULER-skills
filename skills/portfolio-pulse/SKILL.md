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

## Orchestration sequence (~5 fixed calls + a capped bottom-K deep-dive)

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Customer-side `name` (header) + account gate. |
| 2 | `partners(action: 'summary')` | Company-wide totals + portal-access counts. **Its status breakdown proved unreliable** (disagreed with the roster — 2026-06-01 live run); do NOT use it for the status distribution. |
| 3 | `performance(action: 'company', start_date, end_date)` | Own-company aggregate (booking / billings / deal count / win rate) for portfolio totals. |
| 4 | `performance(action: 'overall', entity_key, start_date, end_date, page: 1, limit: N)` | **Terminal** ranked top-N partners + aggregate metrics in one call. Ranks by **billed/invoiced revenue** (`entity_key: 'revenue'`) — a partner can rank with revenue while having 0 closed-won deals. |
| 5 | `partners(action: 'list', page: 1, limit: 100)` | Roster (name + status) — **the canonical source for the status distribution AND the at-risk segment**. Page if needed; note if truncated. |

`overall` is terminal — it returns ranking + aggregates together; do NOT loop
per-partner `partner_artifacts`/`commissions` across the WHOLE portfolio for a pulse.
The only per-partner fetch is the **capped bottom-K deep-dive** (K ≈ 5, the at-risk/watch
tail — see §Segmentation), which upgrades just those few to a full health score. If the user
wants depth on one partner, suggest `/euler:generate-qbr <partner>`.

> **Roster status comes from `partners(list)`, not `summary`.** On the 2026-06-01
> live run, `summary` returned a status breakdown that only accounted for 35 of 42
> partners and disagreed with the per-entry roster. Always compute the status
> distribution by counting `partners(list)` entries. Use `summary` only for the
> grand total + portal-access counts, and treat it skeptically.

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

## Segmentation (coarse rank from the 2 existing calls; deep-dive only the bottom-K tail)

- **Portfolio totals**: partner count (from `list`/`summary`), revenue/deals in window
  (from `company` + `overall`).
- **Status distribution** (count `partners(list)` entries — NOT `summary`):
  Active / Onboarding / Prospecting / Inactive / **No status set**.
- **Top performers** (overall): top N by revenue (billed/invoiced), with deal count.

### Partner health (coarse rank → deep-dive the tail)

Score the portfolio per [`docs/partner-health-model.md`](../../docs/partner-health-model.md) in
**coarse** mode — Production (from `performance(action:'overall')`) + Status (from
`partners(action:'list')`), the two calls this skill already makes. Rank all partners by the
coarse score and segment by band (the hard-rule caps still apply: Inactive → At-risk, etc.).

Then **deep-dive only the bottom-K** (K ≈ 5, the at-risk/watch tail): fetch their per-partner
sources and upgrade them to a **full** score + a one-line reason for "Needs attention". Cap K so
the call budget stays small. **Label clearly** that the leaderboard is coarse-ranked and only the
tail was deep-scored — never imply every partner got the full model. Deep-link each at-risk row to
`/euler:generate-qbr <partner>` for the full picture.

Portfolio-specific notes that still hold:

- The **No status configured** cohort is a real coarse signal in its own right — Status feeds the
  coarse score, so a large no-status share is the #1 item (the program can't be measured/worked
  until the roster is segmented; action = "segment the roster & assign statuses", not pipeline).
- Count statuses from `partners(list)`, NOT `summary` (the summary breakdown proved unreliable).
- Each "Needs attention" row: band pill (At-risk / Watch) + name + the deep-dived one-line reason +
  one action + the `generate-qbr` deep-link.
- **Coverage gaps**: producing vs dormant share; concentration (top partner = X% of
  ranked revenue).
  - **When producing ≤ 1**, concentration is meaningless (100% of a single record is
    noise) — render it as `n/a` / "insufficient producers", not "100%".
  - Producing count: `overall` returned the full producing set (not a truncated page)
    on the 2026-06-01 run — but verify per run. If the ranking IS capped at top-N,
    label "top-N producing", never imply you saw every partner.

## Output format

Render a **single self-contained HTML file** — no external CSS/fonts/scripts.
Opens in a browser, prints to PDF, or shares by file/link (email, Notion, Slack).
Note: pasting raw HTML into Slack does not render — share the file or a link.

### Euler design system (modern report treatment)
Output follows the **Euler design system** in a modern, landing-page-style layout:
sticky **topbar** with the Euler **text wordmark** → **hero** (eyebrow chip + headline
with a gradient `.accent` span + `.quick-facts` headline stats) → **spotlight** gradient
panel for the headline read → sectioned body (`.section-eyebrow` "01 · …") →
leaderboard `.table-wrap` → `.attention` rows → `.dist` status chips → footer.

Read [`assets/styles.css`](assets/styles.css) and inline its FULL contents into a
single `<style>` block in `<head>` (self-contained). It encodes the tokens — Inter +
**JetBrains Mono** (numerals/`$`), Brand-600 `#2563EB`, gray/status/utility scales,
two-layer shadows. Use ONLY class names defined there; never improvise colors or
fonts. Use the skeleton in [`assets/template.html`](assets/template.html). Model
output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding markdown.

**Language — the EULER product is multilingual.** Render all report copy (headings, labels,
prose) in the language the user used for the request (e.g. a Portuguese request → a Portuguese
report, `<html lang="pt-BR">`). Proper nouns, currency, metric values, and dates stay as-is.
Applies to the rendered report only — these SKILL instructions + CSS class names stay English.

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>`
in the topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer — do
NOT use an `<img>` logo (the remote brand SVG renders broken in Claude's artifact viewer).
The only external dep is Google Fonts (`@import` in the stylesheet); keep the two
`<link rel="preconnect">` tags.

Tone classes follow overall health: `.hero-eyebrow` and `.spotlight` take
`amber`/`red` (or default brand) to match the portfolio state.

**Lightweight & mobile-responsive (required).** The artifact must open fast on any
device: no JavaScript, no images beyond the brand logo, no embedded data URIs or
base64 blobs, no heavy gradients-on-gradients. The stylesheet already handles
responsiveness with fluid `clamp()` type and a table that scrolls on narrow screens —
do NOT add fixed pixel widths, multi-hundred-line inline `<style>` beyond the provided
sheet, or extra web fonts. Keep the `<link rel="preconnect">` tags. Don't bloat the
HTML with repeated rows — cap the leaderboard at N and needs-attention at ~6.

### Required structure (class → meaning; component → design-system)

Follow [`assets/template.html`](assets/template.html). Sections, in order:

1. **Topbar** — Euler `brand-mark` wordmark + `brand-label` "Portfolio Pulse · {Customer}".
2. **Hero** — `hero-eyebrow` (tone) "{window} · {N} partners"; `<h1>` short headline
   with a gradient `.accent` span; subtitle + a `.data-pill` (complete/partial/stale).
3. **Quick facts** (`.quick-facts` → `.fact`): Partners · Producing (window) ·
   Revenue (window) · Concentration. Numerals render in JetBrains Mono via `.fact-value`.
4. **Spotlight** (`.spotlight` tone amber/red): the one-line read + 2–3 sentences
   (biggest signal · biggest risk · first move). Wrap key figures in `<span class="num">`.
5. **Top performers** (`01 · Leaderboard`): `.table-wrap` table — `#` (`.rank`, rank 1
   = `.rank.top`), Partner (+ optional `.cell-note`), Revenue, Deals (numeric cols mono).
   **Label the depth** (per the model's "always label depth" rule): a `.cell-note` / section
   caption stating the board is **coarse-ranked** (Production + Status) and only the at-risk/watch
   tail was deep-scored to a full health score — never imply every partner got the full model.
6. **Needs attention** (`02 · Action`): `.attention` → `.att-row` (status-pill carrying the
   **band** label — At-risk / Watch — + name + the deep-dived one-line reason/action). These are
   the deep-dived bottom-K tail (full score + reason), NOT every partner. Cap ~6, top by severity.
   **Omit the whole section if empty.**
7. **Status distribution** (`03 · Roster`): `.dist` → `.dist-chip` per status
   (Active/Onboarding/Prospecting/Inactive/No status set), counted from `partners(list)`.
8. **Footer** — Euler `brand-mark footer-mark` wordmark + "Portfolio Pulse · {Customer} · {window}".

### Status pill vocabulary (portfolio)
| Emoji | Pill | Meaning |
|-------|------|---------|
| 🟢 | `Producing` | revenue (billed/invoiced) in the window |
| 🟡 | `Watch` | active, no production in window, OR onboarding/prospecting |
| 🔴 | `At risk` | active + zero production, inactive blockers, OR a large no-status cohort |
| ⚪ | `Inactive` | `status = Inactive` |
| 🟣 | `No status` | roster entry with no status configured (use the `violet` pill) |

Do not print internal labels like `amber` — the semantic label tells the reader what
the colour means.

### Section omission
Silence empty sections (no "No X data" placeholders). The absence is the signal.

## Anti-hallucination rules (not optional)

0. **No internal IDs** in output (`partner_id`, deal_id, etc.) — orchestration only.
1. **`overall` ranks by billed/invoiced revenue (`entity_key: 'revenue'`), NOT only
   closed-won, and NO commissions.** Verified 2026-06-01: a $100 *billing* ranked
   while `company` showed 0 closed-won deals. Label the metric "Revenue (window)";
   only say "closed-won" when the deal count is actually > 0. Never conflate with
   commissions. State the basis in `.fact-sub` (e.g. "billed · 0 closed-won deals").
2. **Coarse ranking uses cheap signals only** (Production + Status) — the leaderboard has no
   per-partner aging data, so no "stalled N days" claims about partners outside the tail. The
   deep-dived bottom-K DO fetch their per-partner sources, so their one-line reason may cite the
   full-model factors (incl. recency); keep every such claim grounded in that fetched data.
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
6. partners(action: 'list') → roster → coarse-score every partner (Production + Status) per the
   shared health model; segment by band. Deep-dive only the bottom-K (~5) tail to a full score +
   reason for "Needs attention".
7. Renders the portfolio-pulse HTML per the template (leaderboard labelled coarse-ranked; only the
   tail deep-scored).

User: opens the HTML in a browser / saves as PDF. Deep-links into generate-qbr for
the two partners flagged "Needs attention".
```

## Why this skill exists

A partner manager with 40+ partners has no fast portfolio-wide read today — they'd
open the dashboard, eyeball rankings, and manually spot dormant partners. QBR and
briefing are deliberately per-partner. portfolio-pulse fills the gap: one prompt →
a one-screen pulse that surfaces the few partners worth a deeper QBR, in seconds.
