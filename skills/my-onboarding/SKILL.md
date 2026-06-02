---
name: my-onboarding
description: Generate a partner's own onboarding and certification progress report — what's done, what's left, and what's overdue across the flows assigned to them by one customer, using EULER MCP tools. Use this skill whenever a partner wants their personal onboarding status — phrases like "where am I in my onboarding", "my certification progress", "what onboarding steps do I have left", "am I done with onboarding", "show my training progress". Partner-facing (a partner viewing their OWN progress), NOT a customer admin reviewing partners — that distinction selects this skill over portfolio-pulse / generate-qbr.
---

# my-onboarding — your onboarding & certification progress

## When to use this skill

Invoke when **a partner** wants a read on **their own** onboarding / certification
progress with one customer — what's done, what's left, what's overdue:

- "Where am I in my onboarding?" / "Am I done with onboarding?"
- "My certification progress" / "Show my training progress"
- "What onboarding steps do I have left?"
- `/euler:my-onboarding`

DO NOT invoke for:

- **A customer admin reviewing partners** — portfolio-wide is `portfolio-pulse`; a
  single-partner deep review is `generate-qbr`. Those are customer-scope and look
  *at* partners; this skill is the partner looking at *themselves*.
- **A customer admin asking "who's stuck in onboarding?"** — not feasible today (the
  customer surface exposes no per-partner progress). Route to `portfolio-pulse` for the
  roster-level read.

The distinction that selects this skill: **the connected account is the partner, and
the subject is that same partner's own flows.** Per-flow progress (`percent_complete`,
step buckets, due dates, badge) is exposed only partner-side — that is why this is the
partner's self-service view, not a customer-admin one.

## Account type — required: partner

This skill is the **inverse** of the customer-admin gate: it needs a connection with a
`type === 'partner'` entry (the partner viewing their own progress).

**Step 1 is always `list_accounts`.** Apply the account gate in
[`references/account-gate.md`](references/account-gate.md) before anything else:

- Connected account has a `type === 'partner'` entry → proceed (partner context); take
  `partner_id` + `affiliate_company_name` from that entry.
- **Customer-only connection** (no `type === 'partner'`) → emit the friendly gate message
  and **STOP** (do not proceed into a raw `forbidden_scope`): "my-onboarding shows *your*
  progress as a partner; you're connected as a customer admin — partner onboarding lives
  in your dashboard: `<dashboard_url>`." Use the `dashboard_url` from the customer entry.
- Both roles → proceed as the partner (use the partner entry).

`partner_id` comes **only** from the chosen `type: 'partner'` entry — **never** from
`partner_directory_search` (that returns a directory `profile_id`, rejected downstream as
`partner_not_in_consent`). Translate any escaping `forbidden_scope` into the same friendly
message; never show the user `forbidden_scope` or any `euler_*` code.

## Inputs (optional — never block)

No date window — progress is current state; "overdue" comes from the tool's own
`overdue_count` / `flow_due_date`, never a user-supplied window.

| Input | Default | Accepts |
|---|---|---|
| **Which customer** | the only `type:'partner'` account | a customer name → match `affiliate_company_name`. If >1 partner account and the user named none (or it matches several), **ask** which — show the `affiliate_company_name` list. |
| **Flow filter** | all assigned flows | "just my certifications" / "the X onboarding" → filter the assigned-flow list by `flow_type` / title. |

One partner + one customer pairing per invocation — do not fan out across accounts.

## Orchestration sequence

3 fixed calls + one progress call per assigned flow. For exact response field paths per
tool, consult [`references/mcp-field-paths.md`](references/mcp-field-paths.md) (both
`partner_flow_*` tools are `scope: partner`; a customer-admin session cannot see them).

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Account gate + `partner_id` + customer `affiliate_company_name` (header). |
| 2 | `partner_flow_details` (`partner_id`, **no drill-down param**) | The partner's currently-assigned flows — `flow_id`, title, type. The discovery anchor; do NOT pass `name`/`flow_id`/`flow_step_id` here (they are mutually exclusive drill-downs). |
| 3 | `partner_flow_progress` (`partner_id`, `flow_id`) — **once per flow** | `percent_complete`; counts (`total_steps`, `done_count`, `failed_count`, `to_do_count`, `overdue_count`); per-status detail lists (`to_do_details` / `overdue_details` / `done_details` / `failed_details`); `flow_title`, `flow_type`, `flow_due_date`, `flow_due_in_days`, `certification_badge`. |

Realistically 1–5 flows. Cap at ~8 progress calls; if a partner has more, render the
top 8 by urgency and add a one-line footnote.[^cap] A non-assigned or empty flow returns
empty counts + empty detail lists (**not** an error) → **skip it silently**.

[^cap]: A partner with >8 assigned flows is unusual; the cap bounds the call count. Order by urgency (overdue first) before truncating so the cut never hides an overdue flow.

### Error handling
- Customer-only account → friendly gate message (see §Account type), STOP.
- `backend_data_issue` on `list_accounts` → surface its `support_email`, note reconnecting
  won't help, and continue with whatever the flow tools return.
- `forbidden_scope` escaping mid-run → translate via `references/account-gate.md` into the
  friendly message; never surface the raw code.
- Any single `partner_flow_progress` empty/errors → skip that flow; one-line footnote at
  the end if a named flow could not be read. No giant banner.
- **Zero assigned flows** → a positive empty state ("Nothing's assigned to you with
  {Customer} yet"), no tables, no fabricated rows.

## Progress logic

- **Overall %** = Σ`done_count` / Σ`total_steps` across all flows — **NOT** the average of
  per-flow `percent_complete` (a 2-step and a 20-step flow must not weigh equally). State
  the basis in `.fact-sub` (e.g. "12/20 steps · across 3 flows"). Zero-denominator collapse:
  Σ`total_steps` = 0 → render **"—"**, not "0%".
- **Per-flow status / tone** (first match wins):
  - 🟢 **Done** — `percent_complete` = 100% (certification badge earned, for Certification flows)
  - 🔴 **Overdue** — `overdue_count` > 0
  - 🟡 **In progress** — started (`done_count` > 0), no overdue
  - ⚪ **Not started** — `done_count` = 0
- **Hero tone + spotlight** follow the **worst** per-flow status: any flow overdue → red;
  else any in progress → amber; all done → green.
- **Spotlight = the single most-urgent move:** the flow with overdue steps (or, if none
  overdue, the soonest `flow_due_date`) + its top blocking step from `overdue_details` /
  `to_do_details`. e.g. "Finish *{step}* in *{flow}* — due {date}."
- **Most urgent first:** order the per-flow sections **overdue → due-soon → in-progress → done**.

## Output format

Render a **single self-contained HTML file** — no external CSS/fonts/scripts beyond the one
web-font import. Opens in a browser, prints to PDF, or shares by file/link (email, Notion,
Slack). Note: pasting raw HTML into Slack does not render — share the file or a link.

### Euler design system (modern report treatment)
Output follows the **Euler design system** in a modern, landing-page-style layout:
sticky **topbar** with the Euler **text wordmark** → **hero** (eyebrow chip + headline with
a gradient `.accent` span + `.quick-facts` headline stats) → **spotlight** gradient panel
for the one most-urgent move → per-flow sections (`.section-eyebrow` "01 · …") each with a
`.progress` bar + `.attention` step rows → footer.

Read [`assets/styles.css`](assets/styles.css) and inline its FULL contents into a single
`<style>` block in `<head>` (self-contained). It encodes the tokens — Inter + **JetBrains
Mono** (numerals/percentages), Brand-600 `#2563EB`, gray/status/utility scales, two-layer
shadows, and the `.progress` / `.bar` component. Use ONLY class names defined there; never
improvise colors or fonts. Use the skeleton in [`assets/template.html`](assets/template.html).
Model output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding markdown.

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>`
in the topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer — do NOT
use an `<img>` logo (the remote brand SVG renders broken in Claude's artifact viewer). The
only external dependency is Google Fonts (`@import` in the stylesheet); keep the two
`<link rel="preconnect">` tags.

Tone classes follow the worst per-flow status: `.hero-eyebrow` and `.spotlight` take
`amber`/`red` (or default brand when all done) to match the partner's overall state.

**Lightweight & mobile-responsive (required).** The artifact must open fast on any device:
no JavaScript, no images beyond the brand wordmark, no embedded data URIs or base64 blobs,
no heavy gradients-on-gradients. The stylesheet already handles responsiveness with fluid
`clamp()` type and a `.progress` bar that reflows at 360px — do NOT add fixed pixel widths,
multi-hundred-line inline `<style>` beyond the provided sheet, or extra web fonts. Keep the
`<link rel="preconnect">` tags. Don't bloat the HTML with every done step — collapse done to
the count and cap each attention list (footnote overflow).

### Required structure (class → meaning; component → design-system)

Follow [`assets/template.html`](assets/template.html). Sections, in order:

1. **Topbar** — Euler `brand-mark` wordmark + `brand-label` "My Onboarding · {Customer}".
2. **Hero** — `hero-eyebrow` (tone) "{Customer} · {N} flows"; `<h1>` "Your onboarding —
   `<span class="accent">{overall%}</span>` complete"; subtitle + a `.data-pill`
   (complete/partial/stale).
3. **Quick facts** (`.quick-facts` → `.fact`): **Flows assigned · Overall % · Overdue steps ·
   Next due**. Numerals render in JetBrains Mono via `.fact-value`; put the basis in `.fact-sub`
   (e.g. "12/20 steps", overdue flow name, next-due flow).
4. **Spotlight** (`.spotlight` tone amber/red, default brand when all done): the one
   most-urgent move (§Progress logic) + a sentence naming the top blocking step and its due
   date. Wrap key figures in `<span class="num">`.
5. **Per-flow section** (`01 · {Flow title}`, repeated, ordered by urgency): a
   `.section-title` line "{pct}% complete · {done}/{total} steps · {flow_type}" + a
   `status-pill` (tone). Then a `.progress` bar — tone class (`green`|`amber`|`red`) matches
   the flow status, fill width set inline `style="width:{pct}%"` on the inner `.bar`. Then an
   `.attention` block listing **only the to_do + overdue steps** as `.att-row`s
   (`att-name` = step title; `att-meta` = type + "overdue {date}" / "to do"); **done steps
   collapsed into the header count** (never enumerated). A `.note` line "🏅 Certification badge
   earned." **only when `certification_badge` is a real URL.**
6. **Footer** — Euler `brand-mark footer-mark` wordmark + "My Onboarding · {Customer}".

### Status pill vocabulary
| Emoji | Pill | Meaning |
|-------|------|---------|
| 🟢 | `status-pill green` Done | `percent_complete` = 100% (cert badge earned) |
| 🔴 | `status-pill red` Overdue | `overdue_count` > 0 |
| 🟡 | `status-pill amber` In progress | `done_count` > 0, no overdue |
| ⚪ | `status-pill gray` Not started | `done_count` = 0 |

Per-step pills inside `.attention`: overdue steps use `status-pill red` 🔴 Overdue; to-do
steps use `status-pill gray` ⚪ To do. Do not print internal labels like `amber` — the
emoji + word tells the reader what the colour means.

### Section omission
Silence empty sections (no "No X data" placeholders). The absence is the signal. A flow with
no to_do/overdue steps shows just its bar + header (all done). Zero assigned flows → the
positive empty state, no per-flow sections at all.

## Anti-hallucination rules (not optional)

1. **No internal IDs in output** — never render `flow_id`, `flow_step_id`, or
   `assignment_id`; they are orchestration-only.
2. **`partner_id` source** — only from `list_accounts` (`type:'partner'` entry, matched by
   `affiliate_company_name`). **Never** from `partner_directory_search` (its `profile_id` is
   rejected as `partner_not_in_consent`).
3. **Overall % = Σ`done_count` / Σ`total_steps`** across flows — never the average of per-flow
   percents. State the basis. Zero-denominator (Σ total = 0) → render **"—"**, not "0%".
4. **Numerics arrive as strings** → `Number()` every count/percent **before** any math or sort.
5. **Detail lists are loose JSON-string concats** of `{title, description, type}` (same posture
   as `referrals`) → parse defensively. **On parse failure, show the count, not a fabricated
   step list** — never invent step titles.
6. **`certification_badge` sentinels** — `"Not earned yet."` / `"No image attached."` are NOT
   URLs; never render them as an image/link. Show "🏅 badge earned" **only** on a real URL.
7. **"Overdue" only from tool data** — `overdue_count` / `flow_due_in_days` (negative = overdue).
   Never infer overdue from a date you computed yourself.
8. **Test-data heuristic — flag, don't filter.** Placeholder flow titles (`test`, `asdf`,
   numeric-only) are likely test entries; note them, keep them in the counts.
9. **One partner + one customer per invocation.** If the user has multiple partner accounts,
   ask which (see §Inputs); do not aggregate across customers.
10. **Read-only** — this skill surfaces and prioritizes progress; it **never** completes a step,
    changes an assignment, or claims to have done so.

## Example user flow

```
User: "Where am I in my onboarding?"

Claude:
1. Reads this skill.
2. list_accounts → one type:'partner' entry, affiliate_company_name = "Lumon Industries"
   → gate passes (partner role); partner_id resolved from that entry.
3. partner_flow_details(partner_id) → 3 assigned flows:
     • "Partner Onboarding" (Onboarding)
     • "Sales Certification" (Certification)
     • "Q2 Enablement To-Do" (Custom)
4. partner_flow_progress(partner_id, flow_id) ×3 →
     • Partner Onboarding: 100% — done_count 8 / total 8, overdue 0      → 🟢 Done
     • Sales Certification: 60% — done_count 6 / total 10, overdue_count 1 → 🔴 Overdue
     • Q2 Enablement To-Do: 0% — done_count 0 / total 5                   → ⚪ Not started
   Overall = (8+6+0) / (8+10+5) = 14/23 ≈ 61%.
5. Renders the my-onboarding HTML: hero "Your onboarding — 61% complete", RED tone
   (a flow is overdue); quick-facts Flows 3 · 61% · Overdue 1 · Next due {date}; spotlight
   names the overdue step in "Sales Certification" and its due date; three per-flow sections
   ordered Overdue → Not started → Done, each with a tone-matched .progress bar, done steps
   collapsed to the count, and the cert badge line omitted (60% — not earned yet).

User: opens the HTML in a browser / saves as PDF and works the overdue step first.
```

## Why this skill exists

Per-flow completion data — `percent_complete`, step buckets, due dates, certification
badges — is exposed **only** on the partner side (`partner_flow_*`, `scope: partner`); the
customer surface has no per-partner progress, so a customer-admin "who's stuck" view isn't
feasible today. my-onboarding is the partner's self-service onboarding view: one prompt →
a one-screen read of what's done, what's left, and what's overdue across the flows one
customer assigned them. It is the **first partner-facing skill** in the plugin, establishing
the inverse (partner-required) account gate that future partner-scope skills reuse.
