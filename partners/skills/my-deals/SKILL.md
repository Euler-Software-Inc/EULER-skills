---
name: my-deals
description: Show a partner's own deal pipeline with one customer — open deals by stage with amounts, plus closed-won/lost — using EULER MCP tools. Use this skill whenever a partner wants their deals view — phrases like "my deals", "my pipeline", "what deals do I have open", "my deal pipeline", "look up a deal by name". Partner-facing (a partner viewing their OWN deals); for a full self scorecard use my-performance, for a customer admin's review use generate-qbr.
---

# my-deals — your deal pipeline

`my-deals` is a partner-facing READ skill. It pulls a partner's own deal pipeline from the EULER
platform and renders a full HTML report: open deals grouped by stage, hero quick-facts, and a
distribution of deals across stages. Deeper than `my-performance`'s top-5 snapshot — this is the
complete picture.

---

## When to use this skill

Use `my-deals` when a partner asks about **their own deals** with a specific customer:

- "my deals", "my pipeline", "what deals do I have open"
- "show me my deal pipeline", "what's in my pipeline"
- "look up my [deal name] deal" (named lookup → `get_search_deals`)
- "how many deals do I have open", "what's my total pipeline value"

**DO NOT use** for:

- **Full performance scorecard** (commissions, referrals, health score) → use `my-performance`
- **Customer admin reviewing a partner's deals** → use `generate-qbr`
- **Submitting a new referral or deal registration** → use `submit-a-referral`
- **Another partner's deals** — this skill is strictly self-scoped; only the caller's own data

---

## Account type — required: partner

This skill is partner-scoped. The connected account must include a `type === 'partner'` entry.

**Step 1 is always `list_accounts`.** Apply the account gate in
[`references/account-gate.md`](references/account-gate.md) before calling any other tool:

- Connected account has a `type === 'partner'` entry → proceed (partner context); take
  `partner_id` + `affiliate_company_name` from that entry.
- **Customer-only connection** (no `type === 'partner'`) → emit the friendly gate message
  and **STOP**: "my-deals shows your own deals as a partner. You're connected as a customer
  admin — for a partner review use `generate-qbr`, or open your dashboard: `<dashboard_url>`."
  Use the `dashboard_url` from the customer entry.
- Both roles → proceed as the partner (use the partner entry).

`partner_id` comes **only** from the `type: 'partner'` entry — **never** from
`partner_directory_search` (that returns a directory `profile_id`, rejected downstream as
`partner_not_in_consent`). Translate any escaping `forbidden_scope` into the same friendly
message; never show the user `forbidden_scope` or any `euler_*` code.

---

## Inputs (optional — never block)

- **Which customer** — usually inferred from `affiliate_company_name` in the partner's
  `list_accounts` entry. If the user has multiple partner connections, ask once to clarify.
- **A specific deal name** — if the user names a deal (e.g. "look up my Lumon deal"), run
  `get_search_deals(deal_name, partner_id)` as a supplemental lookup. Do not call it for the
  general pipeline view — `partner_artifacts` already returns everything.
- No date range input needed — `partner_artifacts(action:'deals')` is a lifetime snapshot.

Never block on missing inputs. If the user says "my deals" with no further context, proceed
immediately with `list_accounts` → `partner_artifacts`.

---

## Orchestration sequence

For exact response field paths, parsing quirks, and the 9999-day sentinel rule, consult
[`references/mcp-field-paths.md`](references/mcp-field-paths.md).

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Account gate + `partner_id` + `affiliate_company_name` (customer name for header). |
| 2 | `partner_artifacts(action:'deals', partner_id)` | Full deal list: `Deal name`, `stage`, `Amount`, `last_stage_change_date`. |
| 3 _(conditional)_ | `get_search_deals(deal_name, partner_id)` | Single-deal detail — only when the user names a specific deal. |

Compute from the deals list:
- Open count, open total value, avg open deal size
- Closed-won count + total value
- Stage distribution (count per stage)

All `Amount` fields arrive as strings — parse with `Number()` before arithmetic.

### Error handling

- Customer-only account → friendly gate message (see §Account type), STOP.
- `partner_not_in_consent` → tell the user to disconnect + reconnect and include this account
  in their consent selection; do not render a partial report.
- `backend_data_issue` on `list_accounts` → surface its `support_email`, note reconnecting
  won't help, and continue with whatever `partner_artifacts` returns.
- `forbidden_scope` escaping mid-run → translate via `references/account-gate.md` into the
  friendly message; never surface the raw code.
- `partner_artifacts` returns empty or fails → render the positive empty-state message; no crash.

---

## Output format

Render a **single self-contained HTML file** — no external CSS/fonts/scripts beyond the one
web-font import. Opens in a browser, prints to PDF, or shares by file/link.

### How to produce the HTML

1. Read [`assets/styles.css`](assets/styles.css) and inline its **FULL** contents into a single
   `<style>` block in `<head>` (self-contained — do not `<link>` it). It encodes the design
   tokens: Inter + JetBrains Mono (numerals), Brand-600 `#2563EB`, gray/status/utility scales,
   two-layer shadows.
2. Use the skeleton in [`assets/template.html`](assets/template.html) as the structure. Fill in
   data; use **ONLY** class names defined in the stylesheet — never improvise colors, fonts, or
   classes.
3. Model output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding markdown,
   no preamble.

**Language — the EULER product is multilingual.** Render ALL report copy (headings, labels,
prose, stage names, notes) in the **language the user used for the request** — e.g. a
Portuguese request → a Portuguese report (`<html lang="pt-BR">`). Proper nouns, company
names, and raw API values stay as-is. (This applies to the **rendered report only** — these
SKILL instructions and CSS class names stay English.)

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>` in
the topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer — do **NOT**
use an `<img>` logo (the remote brand SVG renders broken in Claude's artifact viewer). The only
external dependency is Google Fonts (`@import` in the stylesheet); keep the two
`<link rel="preconnect">` tags.

**Lightweight & mobile-responsive (required).** No JavaScript, no images, no embedded data
URIs. The stylesheet handles responsiveness with fluid `clamp()` type and scrollable tables at
360px — do not add fixed pixel widths or extra web fonts.

### Required structure (component → meaning)

Follow [`assets/template.html`](assets/template.html). Sections in order:

1. **Topbar** — `brand-mark` "Euler" + `brand-label` "My Deals · {Customer}".

2. **Hero** — `hero-eyebrow` (tone: `green` if healthy spread · `amber` if deals stalled or
   concentrated in early stages · `red` if pipeline empty); `<h1>` "Your pipeline"; subtitle =
   one-line read (e.g. "6 open deals, $72 k total") + a `.data-pill complete`. Then
   `.quick-facts` (`.fact`): **Open deals · Open value · Closed-won · Avg deal size**. Numerals
   render mono via `.fact-value`; basis in `.fact-sub`.

3. **01 · Open pipeline** — `.section-eyebrow` "01 · Open pipeline"; `.table-wrap` table with
   columns **Stage · Deal · Amount**. Group by stage (funnel order, earliest first); within
   each stage sort descending by Amount. Amount is a `numeric` cell. For each deal, add a
   `.cell-note` with "N days in stage" **only** when `last_stage_change_date < 9999` — never
   render the sentinel value as aging. **Empty state**: skip the table, render a `.note`:
   "No open deals yet — submit a referral with `/euler:submit-a-referral`." (localized).
   After the table: a `.note` rollup (e.g. "Total open: $72 k across 6 deals in 4 stages.").

4. **02 · By stage** — `.section-eyebrow` "02 · By stage"; a `.dist` of `.dist-chip` elements,
   one per stage that has at least one open deal. Each chip: a `.swatch` (color-coded by funnel
   position), a `.k` stage name, a `.v` count. A `.note` for any rollup observation.

5. **Footer** — `brand-mark footer-mark` "Euler" + "My Deals · {Customer}" + `.mono`
   "euler · my-deals".

**Tone: second person.** "You/your", factual and actionable. The partner is reviewing their
own pipeline, so keep it direct: state the stage, amount, and aging where valid.

---

## Anti-hallucination rules (not optional)

- **No internal IDs** — never render `partner_id`, deal IDs, or any `euler_*` code in output.
- **The 9999-day sentinel** — `last_stage_change_date ≥ 9999` means no valid date is available;
  render no aging at all for that deal. Do not substitute a different number, do not say
  "unknown days", do not omit the deal from counts — just omit the `.cell-note`.
- **No fabricated aging** — aging may only come from `last_stage_change_date`; never estimate
  or calculate from deal names, stage labels, or any other field.
- **Numerics as strings** — `Amount` and similar fields arrive as strings; always `Number()`
  before arithmetic. Never display the raw string if it looks like `"9999"` for amounts (that
  is a real amount, not a sentinel — the sentinel rule applies only to `last_stage_change_date`).
- **Test-data flag** — if a deal name looks like a test entry (e.g. "Test Deal", "ZZZZ"), flag
  it with "(test?)" but keep it in all counts and totals.
- **One partner, one customer** — only the caller's own `partner_id`; only data returned by
  `partner_artifacts`; never blend data from multiple partner entries or calls.
- **Read-only** — this skill never creates, modifies, or deletes any data.

---

## Example user flow

**User:** "Show me my pipeline with Martus."

1. Call `list_accounts` → find `type: 'partner'` entry for Martus; `partner_id = "p_abc123"`;
   `affiliate_company_name = "Martus"`.
2. Call `partner_artifacts(action:'deals', partner_id='p_abc123')`.
3. Parse results: 6 open deals (Qualified ×2, Demo ×2, Negotiating ×1, Contracting ×1),
   total $72,400; 2 closed-won ($38,000); avg open deal $12,067.
4. Apply aging: 3 deals have `last_stage_change_date < 9999` → render `.cell-note`; the
   remaining 3 have `≥ 9999` → omit `.cell-note` entirely.
5. Inline `styles.css`; fill template; output complete HTML.

**User:** "Look up my Lumon Industries deal."

1. `list_accounts` → `partner_id`.
2. `get_search_deals(deal_name='Lumon Industries', partner_id)` → single deal record.
3. Render a focused view of that deal (stage, amount, aging if valid).

---

## Why this skill exists

Partners often need a quick, accurate view of exactly what is in their pipeline with a given
customer — not the full scorecard, not a QBR PDF, just: what deals are open, at what stage,
for how much. `my-deals` answers that in one call, with the right depth and no noise. It
complements `my-performance` (the scored overview) and `generate-qbr` (the customer-admin
retrospective) by covering the partner's live funnel view.
