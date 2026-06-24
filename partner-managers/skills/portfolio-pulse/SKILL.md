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
- `/euler-for-partner-managers:portfolio-pulse`

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
- **No window → Path A** (default): the lifetime-to-date snapshot (`get_partner_overall_stats`).
- A window ("this quarter", "last 30 days", "Q1 2026", explicit dates, "YTD") **→ Path B**.
  Convert to `start_date` / `end_date` in **`YYYY-MM-DD`** (never a time component — full ISO
  datetimes are mis-parsed downstream).

### 2. Ranking metric
- Default: **`revenue`** (closed-won deal revenue).
- "by deals" / "most wins" → `entity_key: 'deals'`.

### 3. Top N
- Default **10** (`limit: 10`). "top 5" → `limit: 5`.

No partner is named — this is the entire portfolio.

## Orchestration sequence (path-selected)

Step 1 is always `list_accounts` (header + account gate per
[`references/account-gate.md`](references/account-gate.md)). Then pick ONE data path, by
whether the user asked for a **time window**.

### Path A — default snapshot (no window requested) · PREFERRED · scales to 40k
| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Customer-side `name` (header) + account gate. |
| 2 | `get_partner_overall_stats` | **One backend-aggregated call**: total / active / pending partner counts, total / won deal counts, total revenue (sum), and the **top 100 partners by revenue**. **Lifetime-to-date** — label the basis "lifetime", never a window. |
| 3 | `company_invoices(action: 'summary')` | Company-wide invoiced / collected / pending totals (the collections line). Optional — skip silently if empty/forbidden. |

### Path B — windowed (user asked for dates / "this quarter" / "last 30 days" / "YTD")
`get_partner_overall_stats` is unfiltered, so a window uses the multi-call path:

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Header + account gate. |
| 2 | `performance(action: 'company', start_date, end_date)` | Own-company window aggregate (booking / billings / deals / win rate). |
| 3 | `performance(action: 'overall', entity_key, start_date, end_date, page: 1, limit: N)` | **Terminal** ranked top-N + aggregates in one call. Ranks by **billed/invoiced revenue** (`entity_key: 'revenue'`) — a partner can rank with revenue while having 0 closed-won deals. |
| 4 | `partners(action: 'list', page: 1, limit: 100)` | Roster (name + status) — canonical for the status distribution + at-risk segment, **only when the roster is small** (see §Segmentation). |
| 5 | `company_invoices(action: 'summary')` | Collections line (optional). |

### Empty vs. unavailable (Path A)
The tool is **live**. A successful response with `total_revenue` 0 and `top_partners: []` is
**valid empty data** (a tenant with no production yet) — render the zeros, omit the leaderboard,
and do NOT fall back. Only fall back when the tool is **absent** from the toolset or **errors**.

### Fallback — Path A unavailable
If absent/errors, **silently use Path B**, unwindowed. Note: `performance(action:'overall')`
**requires a date range** — pass a wide lifetime range (e.g. `2015-01-01` → today), never omit
dates. Never mention tools or "unavailable" to the user.

`overall` (Path B) is terminal — it returns ranking + aggregates together; do NOT loop
per-partner `partner_artifacts`/`commissions` across the WHOLE portfolio. The only
per-partner fetch is the **capped bottom-K deep-dive** (K ≈ 5), and only when the roster is
small (§Segmentation). For depth on one partner, suggest
`/euler-for-partner-managers:generate-qbr <partner>`.

> **Roster status (small-roster path) comes from `partners(list)`, not `summary`.** On the
> 2026-06-01 live run, `summary`'s status breakdown accounted for only 35 of 42 partners and
> disagreed with the roster. Compute status by counting `partners(list)` entries; use
> `summary` only for grand total + portal-access counts.

For exact response field paths per tool, consult
[`references/mcp-field-paths.md`](references/mcp-field-paths.md). Backend gotchas apply
(dates `YYYY-MM-DD`; numerics arrive as strings; loose JSON parsing).

### Error handling
- Partner-only account → gate message (see §Account type), STOP.
- `backend_data_issue` on `list_accounts` → surface its `support_email`; continue
  with whatever the other company-scope tools return.
- `forbidden_scope` escaping mid-run → translate via `references/account-gate.md`
  into the friendly message; never surface the raw code.
- Any single tool empty/errors → continue; add a one-line footnote at the END of
  the TL;DR naming the missing section. No giant banner.

## Segmentation + the roster scale rule

The fine **status distribution** (Onboarding / Prospecting / No-status) and the
**needs-attention bottom-K deep-dive** both require the full roster
(`partners(action:'list')`), which does NOT scale to tens of thousands. Gate them by size:

- **Total partner count ≤ ~300** (≈ ≤2 pages at `limit: 250`) — fetch the roster and run
  those sections: coarse-rank every partner per
  [`partner-health-model.md`](references/partner-health-model.md) in **coarse** mode
  (Production + Status), segment by band (hard-rule caps apply: Inactive → At-risk, etc.),
  then **deep-dive only the bottom-K** (K ≈ 5, the at-risk/watch tail) to a **full** score +
  one-line reason. **Label** the leaderboard coarse-ranked, tail-only deep-scored; deep-link
  each at-risk row to `/euler-for-partner-managers:generate-qbr <partner>`.
- **Total > ~300 (or Path A):** do NOT fetch the full roster. Render headline counts
  (total / active / pending) + the top-100 leaderboard; **omit** needs-attention; render a
  **coarse** status row (Active / Pending / Other) from the headline counts; add one note:
  *"Full-roster segmentation not run ({N} partners) — showing top 100 by revenue + headline
  totals."*
- Path B's `partners(list)` is itself page-capped — same honesty rule: if truncated, scope
  the claim ("top-N producing"), never imply you saw every partner.

Always-applicable notes:

- **Top performers**: top N by revenue (billed/invoiced on Path B; lifetime on Path A), with deal count.
- The **No status configured** cohort (small-roster path) is itself a coarse signal — a large
  no-status share is the #1 item (action = "segment the roster & assign statuses", not pipeline).
- **Coverage gaps / concentration**: producing vs dormant; top partner = X% of the ranked
  (top-100 / top-N) revenue. **When producing ≤ 1**, concentration is meaningless — render
  `n/a` / "insufficient producers", not "100%".

## Product how-to questions (`euler_help`)

If the user asks how EULER itself works or how to do something in the product — not about
their own data — e.g. "how do I register a deal", "where do I find X in the portal", "how
does onboarding work" — call `euler_help` with their question and answer briefly from its
result. Do not guess about product behavior. This is a tangent to this skill's main job:
answer in 1–3 sentences (no HTML report) and return to the task.

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
3. **Quick facts** (`.quick-facts` → `.fact`): Partners · Active · Revenue · Concentration.
   Revenue basis = **lifetime** (Path A) or **window** (Path B) — state which in `.fact-sub`.
   Add a 4th fact OR a line under the spotlight for the **collections** read from
   `company_invoices`: "Invoiced $X · collected $Y · pending $Z" (program-wide; omit if absent).
   Numerals render in JetBrains Mono via `.fact-value`.
4. **Spotlight** (`.spotlight` tone amber/red): the one-line read + 2–3 sentences
   (biggest signal · biggest risk · first move). Wrap key figures in `<span class="num">`.
5. **Top performers** (`01 · Leaderboard`): `.table-wrap` table — `#` (`.rank`, rank 1
   = `.rank.top`), Partner (+ optional `.cell-note`), Revenue, Deals (numeric cols mono).
   Caption the basis: "ranked by **lifetime** revenue" (Path A) / "ranked by revenue
   (**{window}**)" (Path B). On the **small-roster** path also label the board **coarse-ranked**
   (Production + Status), tail-only deep-scored — never imply every partner got the full model.
6. **Needs attention** (`02 · Action`): `.attention` → `.att-row` (status-pill carrying the
   **band** label — At-risk / Watch — + name + the deep-dived one-line reason/action). These are
   the deep-dived bottom-K tail (full score + reason), NOT every partner. Cap ~6, top by severity.
   **Small-roster path only** — on the large / Path-A path, omit this section and show the scope
   note instead. **Omit the whole section if empty.**
7. **Status distribution** (`03 · Roster`): `.dist` → `.dist-chip`. **Small roster:** full set
   (Active/Onboarding/Prospecting/Inactive/No status set) counted from `partners(list)`.
   **Large / Path A:** a coarse row (Active / Pending / Other) from the headline counts + the
   "full-roster segmentation not run ({N})" note.
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
11. **Path A is lifetime / unfiltered** — never imply "this quarter" on the default
    snapshot; say "lifetime-to-date". Its revenue is the tool's total revenue (sum);
    partner / deal counts are current-state lifetime, not window-filtered.
12. **`company_invoices` is COMPANY-level** (program-wide collections) — never attribute
    invoiced / collected / pending totals to a single partner.
13. **`active_partners` is the snapshot's own count** — it can read 0 even when partners have
    roster status "Live" (different semantics). Don't equate "0 active" with "nothing live /
    dormant program"; label it as the snapshot's active count, and if it conflicts with partners
    you know are Live, state the basis rather than declaring the program dead.

## Example user flow

```
User: "How's my partner portfolio doing?"   (no window → Path A)

Claude:
1. Reads this skill.
2. list_accounts → customer self = "Northwind" (header) + gate passes (customer role).
3. get_partner_overall_stats → one call: 4,200 partners (1,180 active / 240 pending),
   total/won deals, total revenue (lifetime), top 100 by revenue.
4. company_invoices(action: 'summary') → invoiced / collected / pending (collections line).
5. 4,200 > ~300 → no full roster: render headline totals + top-100 leaderboard + a coarse
   Active/Pending/Other row + the "full-roster segmentation not run (4,200)" note.
6. Renders the portfolio-pulse HTML per the template (basis labelled "lifetime").

User: "...and just for this quarter?"   (window → Path B)

Claude: re-runs Path B — performance(company / overall, dates) + (small roster only)
partners(list) for status + bottom-K deep-dive; caption "ranked by revenue (this quarter)".
Deep-links into generate-qbr for partners flagged "Needs attention".
```

## Why this skill exists

A partner manager with 40+ partners has no fast portfolio-wide read today — they'd
open the dashboard, eyeball rankings, and manually spot dormant partners. QBR and
briefing are deliberately per-partner. portfolio-pulse fills the gap: one prompt →
a one-screen pulse that surfaces the few partners worth a deeper QBR, in seconds.
