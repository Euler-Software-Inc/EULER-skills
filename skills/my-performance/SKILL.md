---
name: my-performance
description: Generate a partner's own performance scorecard with one customer — their EULER health score (0–100), key stats (revenue, deals, commissions, referrals), and the single biggest thing to improve — using EULER MCP tools. Use this skill whenever a partner wants their personal performance read — phrases like "how am I doing", "my performance", "my numbers", "my partner scorecard", "how's my pipeline", "am I on track with <customer>". Partner-facing (a partner viewing their OWN numbers), NOT a customer admin reviewing partners — that distinction selects this over generate-qbr / portfolio-pulse.
---

# my-performance — your performance scorecard

## When to use this skill

Invoke when **a partner** wants a read on **their own** performance with one customer —
a fast self-service scorecard: their health score, the headline stats, and the single
biggest thing to improve:

- "How am I doing?" / "How am I doing with {Customer} this quarter?"
- "My performance" / "My numbers" / "My partner scorecard"
- "How's my pipeline?" / "Am I on track with {Customer}?"
- `/euler:my-performance`

DO NOT invoke for:

- **A customer admin reviewing a partner** — that is `generate-qbr` (third-person, the
  full shareable retrospective). This skill is the partner looking at *themselves*.
- **A customer admin wanting the whole roster** — that is `portfolio-pulse` (portfolio-wide
  ranking across all the customer's partners). This skill is one partner, one customer.

The distinction that selects this skill: **the connected account is the partner, and the
subject is that same partner's own numbers.** It is the partner-facing **mirror of
generate-qbr** — same underlying signals, same health model, but self-scoped, framed for
self-improvement ("you/your"), and lighter (a scorecard, not the full doc).

## Account type — required: partner

This skill is partner-scope — the **inverse** of the customer-admin gate. It needs a
connection with a `type === 'partner'` entry (the partner viewing their own numbers).

**Step 1 is always `list_accounts`.** Apply the account gate in
[`references/account-gate.md`](references/account-gate.md) before anything else:

- Connected account has a `type === 'partner'` entry → proceed (partner context); take
  `partner_id` + `affiliate_company_name` from that entry.
- **Customer-only connection** (no `type === 'partner'`) → emit the friendly gate message
  and **STOP** (do not proceed into a raw `forbidden_scope`): "my-performance shows *your*
  numbers as a partner; you're connected as a customer admin — for a partner review use
  `generate-qbr`, or open your dashboard: `<dashboard_url>`." Use the `dashboard_url` from
  the customer entry.
- Both roles → proceed as the partner (use the partner entry).

`partner_id` comes **only** from the chosen `type: 'partner'` entry — **never** from
`partner_directory_search` (that returns a directory `profile_id`, rejected downstream as
`partner_not_in_consent`). Translate any escaping `forbidden_scope` into the same friendly
message; never show the user `forbidden_scope` or any `euler_*` code.

## Inputs (optional — never block)

No partner is named — it is always the caller's own data. Two optional inputs only:

| Input | Default | Accepts |
|---|---|---|
| **Which customer** | the only `type:'partner'` account | a customer name → match `affiliate_company_name`. If >1 partner account and the user named none (or it matches several), **ask** which — show the `affiliate_company_name` list. |
| **Time window** | last **90 days** | "this quarter" / "last 30 days" / "Q1 2026" / explicit dates. Convert to `start_date` / `end_date` in **`YYYY-MM-DD`** (no time component — the datetime form is broken backend-side, same gotcha as `generate-qbr`). |

The 90-day default matches the health model's window for Production / Engagement / Recency.
One partner + one customer pairing per invocation — do not fan out across accounts.

## Orchestration sequence

The **QBR subset, self-scoped** — ~5–6 calls. For exact response field paths and the
backend quirks per tool, consult [`references/mcp-field-paths.md`](references/mcp-field-paths.md)
(numerics arrive as strings; `referrals` is loose JSON; dates are `YYYY-MM-DD`).

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Account gate + `partner_id` + customer `affiliate_company_name` (header). |
| 2 | `performance(action:'partner', partner_id, start_date, end_date)` | **Window** headline metrics: closed-won revenue, deal count, win rate, sales cycle, ACV. |
| 3 | `partner_artifacts(action:'deals', partner_id)` | **Lifetime** open pipeline (`Deal name`, stage, `Amount`). |
| 4 | `commissions(action:'partner', partner_id, start_date, end_date)` | **Window** commissions earned + breakdown. |
| 5 | `referrals(action:'for_partner', partner_id)` | **Lifetime** referrals submitted (+ `Submitted On` dates). |
| 6 | `partner_artifacts(action:'agreements', partner_id)` | Agreements — `Status` + `Signed On`. |

**These six are exactly the signals the health model needs** — so the score in §Your health
score is computed from data already in hand, **no extra calls**. (This is the light scorecard:
no attribution split, no historical quarters, no invoices — those are `generate-qbr`'s heavier
retrospective.)

### Error handling
- Customer-only account → friendly gate message (see §Account type), STOP.
- `partner_not_in_consent` → tell the user to disconnect + reconnect and include this account
  in their consent selection; do not render a partial scorecard.
- `backend_data_issue` on `list_accounts` → surface its `support_email`, note reconnecting
  won't help, and continue with whatever the other tools return.
- `forbidden_scope` escaping mid-run → translate via `references/account-gate.md` into the
  friendly message; never surface the raw code.
- Any single tool empty/errors mid-run → continue; one-line footnote at the END of the read
  if a section could not be loaded. No giant banner; the scorecard must still present.

## Your health score

Compute the partner's health per [`docs/partner-health-model.md`](../../docs/partner-health-model.md)
in **full** mode — you already fetched every source in the Orchestration sequence, so this adds
no extra calls. **Use exactly these five factors and weights — do not rename, drop, re-weight, or
invent factors** (no "Compliance", no 4-factor variants):

| Factor | Weight | From |
|---|---|---|
| Production | 35 | closed-won revenue + deals (window) |
| Pipeline | 20 | open pipeline value |
| Engagement | 20 | referrals submitted + recency |
| Foundation | 15 | foundational agreements signed |
| Recency | 10 | days since last deal/referral |

`score = Σ(factor_norm × weight ÷ 100)` → an integer **0–100**. The per-factor normalization
thresholds, band cutoffs, and hard-rule caps live in the model doc — apply them **verbatim**.

Produce:
- the **score 0–100** (always show the number — never just a band),
- the **band** (Healthy / Watch / At-risk / Ramping),
- the **breakdown** across **all five** factors (each as value out of its weight — e.g.
  "Production 28/35 · Pipeline 8/20 · …"), and
- the **next lever** = the **lowest-contribution** factor, framed as one concrete action
  ("Your biggest lift: Pipeline 8/20 — only $18k open; the others are strong").

**Caps — apply only the model's exact rules; never invent one.** A partner with lifetime
closed-won is **NOT** capped merely for 0 closes in the window — its band comes from the score.
The Watch cap fires only when its full condition holds (0 in-window **and** 0 lifetime
closed-won, or an unsigned foundational agreement **and** 0 lifetime closed-won); name a cap in
the read only then.

This is **transparency** — the partner sees exactly how their customer's health model reads
them, and exactly which move grows the number. Same model `generate-qbr` and `portfolio-pulse`
use, viewed from the partner's own side.

## Output format

Render a **single self-contained HTML file** — no external CSS/fonts/scripts beyond the one
web-font import. Opens in a browser, prints to PDF, or shares by file/link (email, Notion,
Slack). Note: pasting raw HTML into Slack does not render — share the file or a link.

### How to produce the HTML
1. Read [`assets/styles.css`](assets/styles.css) and inline its **FULL** contents into a single
   `<style>` block in `<head>` (self-contained — do not `<link>` it). It encodes the tokens —
   Inter + **JetBrains Mono** (numerals/percentages), Brand-600 `#2563EB`, gray/status/utility
   scales, two-layer shadows, and the `.progress` / `.bar` component.
2. Use the skeleton in [`assets/template.html`](assets/template.html) as the structure. Fill in
   data; use **ONLY** class names defined in the stylesheet — never improvise colors, fonts, or
   classes.
3. Model output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding markdown,
   no preamble.

**Language — the EULER product is multilingual.** Render ALL report copy (headings, labels,
prose, the next lever, the five health factor labels) in the **language the user used for the
request** — e.g. a Portuguese request → a Portuguese scorecard (`<html lang="pt-BR">`). Localize
the five factor labels too (Production → "Produção", etc.) but keep all five factors and the exact
weights. Proper nouns, currency, metric values, and dates stay as-is. (This applies to the
**rendered report only** — these SKILL instructions and CSS class names stay English.)

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>` in the
topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer — do **NOT** use an
`<img>` logo (the remote brand SVG renders broken in Claude's artifact viewer). The only external
dependency is Google Fonts (`@import` in the stylesheet); keep the two `<link rel="preconnect">` tags.

**Lightweight & mobile-responsive (required).** The artifact must open fast on any device: no
JavaScript, no images beyond the wordmark, no embedded data URIs or base64 blobs, no
heavy gradients-on-gradients. The stylesheet already handles responsiveness with fluid `clamp()`
type, tables that scroll on narrow screens, and a `.progress` bar that reflows at 360px — do not
add fixed pixel widths, multi-hundred-line inline `<style>` beyond the provided sheet, or extra
web fonts. Cap repeated rows (top-5 open deals; footnote the overflow).

### Required structure (component → meaning)

Follow [`assets/template.html`](assets/template.html). Sections, in order. Sections marked
**CONDITIONAL** are omitted entirely when their data is empty — silence the section, never print
"No X data".

1. **Topbar** — `brand-mark` "Euler" + `brand-label` "My Performance · {Customer}".
2. **Hero** — `hero-eyebrow` (tone by band) "{Window} · {band}"; `<h1>` "Your performance —
   `<span class="accent">{score}/100</span>` ({band})"; subtitle = the one-line read + a
   `.data-pill` (complete/partial/stale). Then `.quick-facts` (`.fact`): **Revenue · Deals ·
   Commissions · Referrals** (window). Numerals render mono via `.fact-value`; put the basis in
   `.fact-sub`. **Zero-denominator collapse** — when 0 deals closed in the window, do not render a
   win-rate/cycle/ACV fact (omit it; never "0.00%").
3. **Spotlight** (`.spotlight`, tone by band) — `<h2>` the one-line read; `<p>` the breakdown
   (the 2–3 driving factors + any cap that fired) ending with the **next lever** = the
   lowest-contribution factor as one concrete move. Wrap key figures in `<span class="num">`.
4. **01 · Health breakdown** — `.section-eyebrow` "01 · …"; then **all five** factors, each a line
   "**{Factor}** {value}/{weight}" + a `.progress` bar whose inner `.bar` width is set inline
   `style="width:{contribution ÷ weight × 100}%"`, tone class (`green` ≥80% of weight · `amber`
   40–79% · `red` <40%). A `.note` names any cap that fired. This is the transparency view.
5. **02 · Pipeline** — `.table-wrap` table of the **top 5 open deals** by Amount (Deal · Stage ·
   Amount, numeric); a `.note` for the rollup ("+ N more open deals under $1K (…)"). **CONDITIONAL:
   omit the whole section if no open deals.**
6. **03 · Commissions** (`{Window}`) — `.note` prose ("Earned in {window}: $X …"). **CONDITIONAL:
   omit if empty.**
7. **04 · Referrals** (lifetime) — `.note` prose (count + most recent; test-data note if it fires).
   **CONDITIONAL: omit if none.**
8. **05 · Agreements** — `.table-wrap` (Status `status-pill` 🟢/🟡/🔴 · Agreement · Signed numeric
   date or "—"); surface any **unsigned foundational** agreement (it caps Foundation to 0).
   **CONDITIONAL: omit if none.**
9. **Footer** — `brand-mark footer-mark` "Euler" + "My Performance · {Customer}" + `.mono`
   "euler · my-performance".

**Band → tone** (per the model's mapping; the sheet has only default / `amber` / `red`): At-risk →
`red` · Watch → `amber` · Healthy / Ramping → default (brand). The `hero-eyebrow` and `.spotlight`
take that tone. Write the band as its name (`Healthy` / `Watch` / `At-risk` / `Ramping`), never the
tone word.

**Tone: second person.** "You/your", encouraging but honest — it's the partner looking at
themselves, so frame findings as levers ("your biggest lift is …"), not verdicts.

## Anti-hallucination rules (not optional)

1. **No internal IDs in output** — never render `partner_id`, `deal_id`, agreement id, or referral
   id; they are orchestration-only. (When the MCP exposes the partner's CRM ID, render that.)
2. **`partner_id` source** — only from `list_accounts` (`type:'partner'` entry, matched by
   `affiliate_company_name`). **Never** from `partner_directory_search` (its `profile_id` is
   rejected as `partner_not_in_consent`).
3. **Health = the exact model** — use the exact 5 factors / weights / caps from
   [`docs/partner-health-model.md`](../../docs/partner-health-model.md); never rename, drop,
   re-weight, or invent a factor (no "Compliance"). **Always show the 0–100 number.** A factor with
   no data **contributes 0** (never a fabricated value) — state the basis. Name only caps that
   actually fired.
4. **Zero-denominator collapse** — when 0 deals closed in the window, OMIT (do not render as zero)
   the win-rate / sales-cycle / ACV fact. Undefined, not "0.00%".
5. **Numerics arrive as strings** → `Number()` every count/revenue/percent **before** any math or
   sort. Currency normalization: treat `""`/`"$"`/`"$0"`/`"$0.00"` as `$0`; non-zero with thousand
   separators (`$1,234,567`).
6. **Recency / aging only from real, parseable dates** — referral `Submitted On` and any real deal
   date. The deals `last_stage_change_date` is a **duration** string; values **≥ 9999 days** are the
   null/garbage sentinel — **ignore** them. Never write "stalled N days" from the sentinel.
7. **Test-data heuristic — flag, don't filter.** Placeholder names (`asdf`, `test`, `foo`, purely
   numeric, or the customer's own name as a referral) are likely test entries; note them, **keep
   them in the counts**. The partner owns that cleanup decision.
8. **Loose JSON parsing** — `referrals(for_partner)` has a serialization quirk (commas vs colons in
   `result_per_page`); parse defensively. On parse failure, show the count, not fabricated rows.
9. **One partner + one customer per invocation.** If the user has multiple partner accounts, ask
   which (see §Inputs); never aggregate across customers.
10. **Read-only** — this skill surfaces and prioritizes the partner's own numbers; it **never**
    submits a referral, changes a deal, signs an agreement, or claims to have done so.

## Example user flow

```
User: "How am I doing with Martus this quarter?"  (connected as partner "Lumon Industries")

Claude:
1. Reads this skill (my-performance playbook).
2. list_accounts → one type:'partner' entry, affiliate_company_name = "Martus"
   → gate passes (partner role); partner_id resolved from that entry. ("this quarter"
   → start_date / end_date in YYYY-MM-DD.)
3. performance(action:'partner', partner_id, start, end) → window: 1 deal, $12k closed-won,
   win rate (shown, deals > 0), ACV.
4. partner_artifacts(action:'deals', partner_id) → open pipeline: $18k across 2 open deals.
5. commissions(action:'partner', partner_id, start, end) → $1,440 earned this window.
6. referrals(action:'for_partner', partner_id) → 3 lifetime, most recent ~6 weeks ago.
7. partner_artifacts(action:'agreements', partner_id) → MNDA + Partner Agreement, both signed.
   → Health (full mode, no extra calls): Production 24/35 · Pipeline 8/20 · Engagement 14/20 ·
     Foundation 15/15 · Recency 3/10 → score 64/100, band Watch (no cap fired). Lowest
     contribution = Pipeline → next lever.
8. Renders the my-performance scorecard: hero "Your performance — 64/100 (Watch)", AMBER tone;
   quick-facts Revenue $12k · Deals 1 · Commissions $1,440 · Referrals 3; spotlight names the
   breakdown + "Your biggest lift: Pipeline 8/20 — only $18k open"; 01 health breakdown with a
   .progress bar per factor; 02 pipeline (2 open deals); 03 commissions; 04 referrals; 05
   agreements (both signed). Rendered in the language the user asked in.

User: opens the HTML in a browser / saves as PDF and works the pipeline lever first.
```

## Why this skill exists

A partner has no fast self-read today — to see how they're doing with a customer they'd have to
ask their partner manager or piece it together from separate screens. my-performance is the
partner's own scorecard: one prompt → a one-screen read of their health score (0–100), the
headline stats, and the single biggest lever to pull. It is the partner-facing **mirror of
`generate-qbr`** — the QBR is the partner manager reviewing a partner; this is that same partner
reviewing themselves, both reading from the **one** shared `partner-health-model.md` so the score
is consistent across the two lenses.
