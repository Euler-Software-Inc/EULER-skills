---
name: my-referrals
description: List a partner's own submitted referrals and deal registrations with one customer and where each stands (pending / approved / rejected), using EULER MCP tools. Use this skill whenever a partner wants to see the referrals they've sent — phrases like "my referrals", "what referrals did I submit", "status of my referrals", "my deal registrations", "did my referral get approved". Partner-facing (a partner viewing their OWN referrals), NOT a customer admin triaging the queue — that distinction selects this over pending-approvals-triage.
---

# my-referrals — your referrals

## When to use this skill

Invoke when **a partner** wants to see **their own submitted referrals** with one customer —
the full worklist of referrals and deal registrations they've sent, with the current status of each:

- "My referrals" / "What referrals did I submit?"
- "Status of my referrals" / "Did my referral get approved?"
- "My deal registrations" / "Show me what I've referred"
- `/euler:my-referrals`

DO NOT invoke for:

- **A customer admin triaging the approval queue** — that is `pending-approvals-triage` (the
  customer-side worklist). This skill is the partner looking at *their own* submissions.
- **A partner wanting to submit a new referral** — that is `submit-a-referral` (the write skill).
  This skill is read-only.

The distinction that selects this skill: **the connected account is the partner, and the
subject is that same partner's own referral submissions.**

## Account type — required: partner

This skill is partner-scope. It needs a connection with a `type === 'partner'` entry
(the partner viewing their own referrals).

**Step 1 is always `list_accounts`.** Apply the account gate in
[`references/account-gate.md`](references/account-gate.md) before anything else:

- Connected account has a `type === 'partner'` entry → proceed (partner context); take
  `partner_id` + `affiliate_company_name` from that entry.
- **Customer-only connection** (no `type === 'partner'`) → emit the friendly gate message
  and **STOP**: "my-referrals shows your own referrals as a partner. You're connected as a
  customer admin — to triage the approval queue use `pending-approvals-triage`, or open
  your dashboard: `<dashboard_url>`." Use the `dashboard_url` from the customer entry.
- Both roles → proceed as the partner (use the partner entry).

`partner_id` comes **only** from the chosen `type: 'partner'` entry — **never** from
`partner_directory_search` (that returns a directory `profile_id`, rejected downstream as
`partner_not_in_consent`). Translate any escaping `forbidden_scope` into the same friendly
message; never show the user `forbidden_scope` or any `euler_*` code.

## Inputs (optional — never block)

No partner is named — it is always the caller's own submissions.

| Input | Default | Accepts |
|---|---|---|
| **Which customer** | the only `type:'partner'` account | a customer name → match `affiliate_company_name`. If >1 partner account and the user named none (or name matches several), **ask** which — show the `affiliate_company_name` list. |
| **Status filter** | all statuses | "pending" / "approved" / "rejected" — filter the table; mention the filter in the hero subtitle. |

One partner + one customer pairing per invocation — do not fan out across accounts.

## Orchestration sequence

Two calls total. For exact response field paths and backend quirks, consult
[`references/mcp-field-paths.md`](references/mcp-field-paths.md)
(numerics arrive as strings; `referrals` response has a loose-JSON quirk; dates are `YYYY-MM-DD`).

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Account gate + `partner_id` + customer `affiliate_company_name` (header). |
| 2 | `referrals(action:'for_partner', partner_id)` | All referrals submitted by this partner (paginated) — company, type, status, `Submitted On` date. |

If the response is paginated (`result_per_page`), fetch subsequent pages until all referrals
are loaded — parse `result_per_page` loosely (see mcp-field-paths.md for the serialization quirk).

### Error handling

- Customer-only account → friendly gate message (see §Account type), STOP.
- `partner_not_in_consent` → tell the user to disconnect + reconnect and include this account
  in their consent selection; do not render a partial report.
- `backend_data_issue` on `list_accounts` → surface its `support_email`, note reconnecting
  won't help, and continue with whatever `referrals` returns.
- `forbidden_scope` escaping mid-run → translate via `references/account-gate.md` into the
  friendly message; never surface the raw code.
- `referrals` returns empty or fails → render the positive empty-state message; no crash.

## Output format

Render a **single self-contained HTML file** — no external CSS/fonts/scripts beyond the one
web-font import. Opens in a browser, prints to PDF, or shares by file/link.

### How to produce the HTML

1. Read [`assets/styles.css`](assets/styles.css) and inline its **FULL** contents into a single
   `<style>` block in `<head>` (self-contained — do not `<link>` it). It encodes the tokens —
   Inter + JetBrains Mono (numerals), Brand-600 `#2563EB`, gray/status/utility scales, two-layer
   shadows.
2. Use the skeleton in [`assets/template.html`](assets/template.html) as the structure. Fill in
   data; use **ONLY** class names defined in the stylesheet — never improvise colors, fonts, or
   classes.
3. Model output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding markdown,
   no preamble.

**Language — the EULER product is multilingual.** Render ALL report copy (headings, labels,
prose, status labels, CTA note) in the **language the user used for the request** — e.g. a
Portuguese request → a Portuguese report (`<html lang="pt-BR">`). Proper nouns, company names,
dates, and status values from the API stay as-is. (This applies to the **rendered report only** —
these SKILL instructions and CSS class names stay English.)

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>` in the
topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer — do **NOT** use an
`<img>` logo (the remote brand SVG renders broken in Claude's artifact viewer). The only external
dependency is Google Fonts (`@import` in the stylesheet); keep the two `<link rel="preconnect">` tags.

**Lightweight & mobile-responsive (required).** No JavaScript, no images, no embedded data URIs.
The stylesheet handles responsiveness with fluid `clamp()` type and scrollable tables at 360px —
do not add fixed pixel widths or extra web fonts.

### Required structure (component → meaning)

Follow [`assets/template.html`](assets/template.html). Sections in order:

1. **Topbar** — `brand-mark` "Euler" + `brand-label` "My Referrals · {Customer}".
2. **Hero** — `hero-eyebrow` (tone: `green` all approved · `amber` some pending · `red` any
   rejected with none approved · default if no referrals); `<h1>` "Your referrals"; subtitle
   = one-line read (e.g. "6 referrals, 3 pending") + a `.data-pill complete`. Then
   `.quick-facts` (`.fact`): **Total · Pending · Approved · Most recent** (company name +
   date). Numerals render mono via `.fact-value`; basis in `.fact-sub`.
3. **01 · Your referrals** — `.section-eyebrow` "01 · Your referrals"; `.table-wrap` table:
   **Company · Type · Status · Submitted** (columns). Most-recent first. Status as `.status-pill`:
   `green` 🟢 Approved · `amber` 🟡 Pending · `red` 🔴 Rejected · `gray` other (raw value).
   Submitted date in a `numeric` cell. **Empty state**: skip the table, render a `.note`:
   "No referrals yet — submit your first with `/euler:submit-a-referral`." (localized).
   After the table: a `.note` CTA — "To submit a new referral, use `/euler:submit-a-referral`."
4. **Footer** — `brand-mark footer-mark` "Euler" + "My Referrals · {Customer}" + `.mono`
   "euler · my-referrals".

**Tone: second person.** "You/your", informative — the partner is checking their own pipeline
of referrals, so keep it factual and actionable ("Pending review by Martus", "Submit another").

## Anti-hallucination rules (not optional)

1. **No internal IDs in output** — never render `partner_id` or any referral ID; orchestration-only.
2. **`partner_id` source** — only from `list_accounts` (`type:'partner'` entry). Never from
   `partner_directory_search`.
3. **Status/date only from real fields** — status from the status field, date from `Submitted On`.
   Never fabricate a status or date. Render unrecognized statuses as-is with the `gray` pill.
4. **Loose JSON parsing** — `referrals(for_partner)` has a serialization quirk (commas vs colons
   in `result_per_page`); parse defensively. On parse failure, show the count if available;
   never render fabricated rows.
5. **Test-data heuristic — flag, don't filter.** Placeholder names (`asdf`, `test`, `foo`, purely
   numeric, or the partner's own company name as a referred company) are likely test entries;
   append `(test?)` to the company name and note the count in a footer footnote. Keep them in all
   counts — the partner owns that cleanup decision.
6. **Numerics arrive as strings** → `Number()` before any math or sort.
7. **One partner + one customer per invocation.** If the user has multiple partner accounts,
   ask which (see §Inputs); never aggregate across customers.
8. **Read-only** — this skill shows referral status; it **never** submits a referral, changes a
   status, or claims to have done so. Direct submission to `/euler:submit-a-referral`.

## Example user flow

```
User: "What referrals have I submitted to Martus?"  (connected as partner "Lumon Industries")

Claude:
1. Reads this skill (my-referrals playbook).
2. list_accounts → one type:'partner' entry, affiliate_company_name = "Martus"
   → gate passes (partner role); partner_id resolved from that entry.
3. referrals(action:'for_partner', partner_id) → 6 referrals returned:
   - "Acme Corp" · Referral · approved · 2026-05-01
   - "Dunder Mifflin" · Deal registration · pending · 2026-04-18
   - "Initech" · Referral · pending · 2026-04-02
   - "Umbrella Ltd" · Deal registration · approved · 2026-03-15
   - "Parallax" · Referral · pending · 2026-02-28
   - "test123" · Referral · rejected · 2026-01-10  ← likely test entry (flagged)
4. Renders the my-referrals report: hero "Your referrals", AMBER tone (3 pending);
   quick-facts Total 6 · Pending 3 · Approved 2 · Most recent "Dunder Mifflin 2026-04-18";
   worklist table sorted most-recent first with status pills; CTA note;
   footnote "(1 entry flagged as possible test data)". Rendered in the language the user asked in.

User: follows up "did my Dunder Mifflin deal reg get approved?" → answer: still pending.
```

## Why this skill exists

A partner has no fast self-read on their referral pipeline today — to check which submissions
are pending or approved they'd have to ask their partner manager or dig through dashboard screens.
`my-referrals` is the partner's own referral tracker: one prompt → a clean worklist with statuses,
sorted newest first, with counts at a glance. It is the partner-facing **complement to
`pending-approvals-triage`** — that tool shows the customer admin what's waiting on them; this
shows the partner what *they* sent and where each one stands. Together, both sides see the
same referral queue from their own perspective.
