---
name: pending-approvals-triage
description: Build a prioritized, age-sorted worklist of everything awaiting a customer admin's approval — partner applications, pending referrals, and pending deal registrations — using EULER MCP tools. Use this skill whenever a partner manager wants to triage what's stuck in their approval queue — phrases like "what's pending approval", "what do I need to approve", "my approval queue", "any pending partners or referrals", "what's waiting on me", "triage approvals" — and wants the oldest/most-overdue items surfaced first.
---

# Pending Approvals Triage — one age-sorted worklist of what's waiting on you

## When to use this skill

Invoke when a customer admin wants to clear their approval backlog:

- "What's pending approval / waiting on me?"
- "My approval queue", "triage approvals"
- "Any pending partners, referrals, or deal registrations?"
- `/euler:pending-approvals-triage`

DO NOT invoke for:

- **Approving an item** — this skill is read-only; it surfaces + prioritizes the
  queue and deep-links to the dashboard to act. It does not approve anything.
- **A portfolio overview** — use `portfolio-pulse`.
- **A single partner's detail** — use `generate-qbr` / `partner-briefing`.

## Account type — required: customer admin

For **customer admins / partner managers**. NOT usable from a partner-only account.
**Step 1 is always `list_accounts`.** Apply [`references/account-gate.md`](references/account-gate.md):
proceed only with a `type === 'customer'` entry; a partner-only connection gets the
friendly gate message and STOPs (no raw `forbidden_scope`).

## Inputs (all optional)

- **Type filter** — default: all three queues. Accept "only referrals", "only deal
  registrations", "partner approvals only".

No date window — pending is current state. "Age" is how long each item has waited.

## Orchestration sequence (~4 calls)

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Customer-side `name` (header) + account gate. |
| 2 | `partners(action: 'pending')` | Partner applications awaiting approval. |
| 3 | `referrals(action: 'search', os_referral_type: 'Referral', filter_status: 'pending')` | Referrals awaiting review. |
| 4 | `referrals(action: 'search', os_referral_type: 'Deal Registration', filter_status: 'pending')` | Deal registrations awaiting review. |

`os_referral_type` is **required** for `search` — that's why referrals + deal
registrations are two separate calls. `filter_status` matches Bubble **literally** —
use the exact lowercase `pending`. Honor the user's type filter by skipping the
queues they excluded.

For response field paths, see [`references/mcp-field-paths.md`](references/mcp-field-paths.md)
(provisional — validate on first run). Backend gotchas: numerics arrive as strings;
parse `"Submitted On"` dates loosely; some payloads are stringified JSON.

### Error handling
- Partner-only account → gate message, STOP.
- `backend_data_issue` on `list_accounts` → surface its `support_email`; continue.
- `forbidden_scope` escaping mid-run → translate via `account-gate.md`; never show the code.
- A single queue empty/erroring → continue; footnote which queue is incomplete.

## Triage logic (age / SLA)

- Compute each item's **waiting age** from `"Submitted On"`. For partner applications,
  use an applied/created date if present; if none, list it without an age and say so.
- Merge all three types into ONE **worklist, oldest-first**, each row tagged with its
  type (Partner app · Referral · Deal reg).
- **SLA color by age:** 🔴 > 14 days · 🟡 7–14 · 🟢 < 7.
- Per-queue counts + the single oldest wait feed the hero.
- **Inbox zero:** if all three queues are empty, render a positive spotlight ("Nothing
  awaiting approval") and omit the worklist.

## Output format

Single self-contained HTML, following the **Euler design system** in the modern
treatment (same stylesheet family as `portfolio-pulse`).

### Lightweight & mobile-responsive (required)
No JavaScript. **No images** — the brand is a text wordmark ("Euler",
`.brand-mark` / `.footer-mark`); do NOT add an `<img>` (the remote logo renders
broken in Claude). Fonts load non-blocking (`display=swap` + the `preconnect` tags in
`<head>`). Fluid `clamp()` type; the worklist table scrolls on narrow screens. Must
look right at 360px. Cap the worklist at a sensible length (e.g. 25 rows) + note any
overflow — keep the HTML small.

### How to produce the HTML
Read [`assets/styles.css`](assets/styles.css) and inline its FULL contents into one
`<style>` block. Use ONLY its class names; never improvise colors/fonts. Use the
skeleton in [`assets/template.html`](assets/template.html). Output is the complete
HTML (`<!DOCTYPE html>` → `</html>`), no surrounding markdown. Keep the
`<link rel="preconnect">` tags.

### Structure (sections in order)
1. **Topbar** — Euler wordmark + "Pending Approvals · {Customer}".
2. **Hero** — `hero-eyebrow` (tone red/amber/green by worst SLA) "{total} waiting ·
   oldest {N}d"; `<h1>` short headline with a gradient `.accent`; subtitle + data-pill.
3. **Quick facts** (`.quick-facts`): Total pending · Partner apps · Referrals ·
   Deal regs · Oldest wait. Numerals in mono via `.fact-value`.
4. **Spotlight** (tone): what to clear first + the most-stuck item.
5. **Worklist** (`01 · Worklist`, `.table-wrap`): Age (oldest first; SLA-colored
   `.status-pill`) · Type (tag) · Item · Waiting since · Action (deep-link
   "Approve in dashboard" using the account's `dashboard_url`).
6. **Footer** — Euler wordmark + "Pending Approvals · {Customer}".

Status-pill tones for the Age column: 🔴 `red` (>14d) · 🟡 `amber` (7–14d) · 🟢 `green`
(<7d). Use the `violet` pill for the "Partner app" type tag if you want type-color.

## Anti-hallucination rules (not optional)

0. **No internal IDs** in output (referral id, partner_id, etc.).
1. **Read-only — never claim to have approved anything.** The action column deep-links
   to the dashboard; the skill does not call any write tool.
2. **Age only from a real parseable date.** If an item has no parseable
   `"Submitted On"` / applied date, show "—" / "date n/a" — never fabricate an age.
3. **`filter_status: 'pending'` is a literal match** (exact lowercase). Don't invent
   other status spellings.
4. **Numerics arrive as strings** — parse before sorting/counting.
5. **Loose JSON parsing** — `partners(pending)` / `referrals(search)` may return
   stringified arrays; parse defensively. If parsing fails, surface an error — don't guess.
6. **Test-data heuristic — flag, don't filter.** Placeholder names (`test`, `asdf`,
   numeric-only) are likely test entries; note them, keep in counts.
7. **Silence empty queues** (no "No X" rows); "Inbox zero" only when ALL are empty.
8. **No system internals in output** — no tool names, no field paths, no `euler_*` /
   `forbidden_scope` codes shown to the user.

## Example user flow

```
User: "What's waiting on me to approve?"

Claude:
1. Reads this skill.
2. list_accounts → customer self = "Acme PRM" (header) + gate passes.
3. partners(action: 'pending') → 2 partner applications awaiting approval.
4. referrals(search, os_referral_type: 'Referral', filter_status: 'pending') → 5 pending.
5. referrals(search, os_referral_type: 'Deal Registration', filter_status: 'pending') → 3 pending.
6. Merge → 10 items, oldest-first; oldest is a referral waiting 23 days (🔴).
7. Renders the triage worklist HTML.

User: opens it, works the list top-down, approves each in the dashboard.
```

## Why this skill exists

Approvals scatter across partner applications, referrals, and deal registrations —
a partner manager has no single view of "what's waiting on me, oldest first." Items
age silently and partners feel ignored. This skill compresses the whole backlog into
one prompt and one age-sorted worklist, so nothing overdue slips through.
