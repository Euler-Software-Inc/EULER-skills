# my-onboarding — design spec

> Date: 2026-06-02 · Status: approved design, pre-implementation.
> Skill for the EULER-skills plugin. Companion plan:
> [`PLAN-account-aware-skills.md`](../../PLAN-account-aware-skills.md).
> **First partner-facing skill** — establishes the inverse (partner-required) account gate.

## 1. Purpose & audience

A partner sees **their own** onboarding / certification progress with one customer —
what's done, what's left, and what's overdue — as a self-contained HTML report.
Audience: **a partner** (PAM / partner-side user), NOT a customer admin. Read-only:
it surfaces and prioritizes the partner's own flow progress; it does not complete
steps or change assignments.

Why it exists: per-flow completion data (`percent_complete`, step buckets, due dates,
certification badges) is exposed **only** on the partner side (`partner_flow_*`,
`scope: "partner"`). A customer-admin "who's stuck" view is NOT feasible today — the
customer surface has no per-partner progress (documented in §9 + the MCP follow-up).

## 2. Account gate (INVERSE of the customer-admin skills)

`scope: partner`. **Step 1 is `list_accounts`.** This skill requires a
`type === 'partner'` entry (the mirror of the customer-admin gate):

- No `type === 'partner'` entry (customer-only connection) → friendly message
  ("my-onboarding shows *your* progress as a partner; you're connected as a customer
  admin — partner onboarding lives in your dashboard: `<dashboard_url>`") and STOP.
- Multiple partner accounts → pick by `affiliate_company_name` (ask only if ambiguous;
  one partner+customer per invocation).
- `partner_id` comes from the chosen partner entry. **Never** from
  `partner_directory_search` (returns `profile_id` → `partner_not_in_consent`).
- Translate any escaping `forbidden_scope` into the same friendly gate message.

See [`references/account-gate.md`](../../skills/my-onboarding/references/account-gate.md)
(partner-side variant of the shared convention).

## 3. Inputs (optional — never block)

| Input | Default | Accepts |
|---|---|---|
| Which customer | the only partner account; ask if >1 | a customer name → match `affiliate_company_name` |
| Flow filter | all assigned flows | "just my certifications", "the X onboarding" → filter by `flow_type` / title |

No date window — progress is current state; "overdue" comes from the tool's own
`overdue_count` / `due_date`, not a user window.

## 4. Orchestration (3 fixed calls + N per-flow)

1. `list_accounts` → gate + `partner_id` + customer name (header).
2. `partner_flow_details` (`partner_id`, no drill-down param) → the partner's assigned
   flows (flow_id, title, type). This is the discovery anchor for partner-side flows.
3. `partner_flow_progress` (`partner_id`, `flow_id`) **once per flow** → `percent_complete`,
   counts (`total_steps`, `done_count`, `failed_count`, `to_do_count`, `overdue_count`),
   per-status detail lists (`to_do_details`, `overdue_details`, `done_details`,
   `failed_details` — JSON-string concats of `{title, description, type}`), `flow_due_date`,
   `flow_due_in_days`, `flow_type`, `certification_badge`.

Realistically 1–5 flows. Cap at ~8 progress calls with a footnote if a partner has more.
Any flow erroring/empty → skip silently (non-assigned `flow_id` returns empty, not error).

## 5. Progress logic

- **Overall %** = Σ`done_count` / Σ`total_steps` across all flows (NOT the average of
  per-flow percents — a 2-step and a 20-step flow must not weigh equally). State the
  basis. Zero-denominator collapse: if Σ`total_steps` = 0, show "—", not "0%".
- **Per-flow status / tone** (first match wins):
  - 🟢 **Done** — `percent_complete` = 100% (badge earned for Certification flows)
  - 🔴 **Overdue** — `overdue_count` > 0
  - 🟡 **In progress** — started (`done_count` > 0), no overdue
  - ⚪ **Not started** — `done_count` = 0
- **Hero tone + spotlight** driven by the worst per-flow status: any overdue → red; else
  any in-progress → amber; all done → green.
- **Spotlight = the single most urgent move:** the flow with overdue steps (or, if none
  overdue, the soonest `flow_due_date`) + its top blocking step from `overdue_details` /
  `to_do_details`. e.g. "Finish *{step}* in *{flow}* — due {date}."
- **Most urgent first:** order per-flow sections overdue → due-soon → in-progress → done.

## 6. Output — Euler design system (modern, lightweight, responsive · Approach A)

Own copy of the canonical `styles.css` (text **wordmark**, no image). Structure:

1. **Topbar** — wordmark + `brand-label` "My Onboarding · {Customer}".
2. **Hero** — `hero-eyebrow` tone + "{Customer} · {N} flows"; `<h1>` "Your onboarding —
   `<span class="accent">{overall%}</span>` complete"; subtitle + `.data-pill`;
   `.quick-facts`: **Flows · Overall % · Overdue steps · Next due**.
3. **Spotlight** (tone) — the one most-urgent move (§5).
4. **Per-flow sections** (`01 · {Flow title}`) — a slim **progress bar** + "{pct}% ·
   {done}/{total} steps" + a `status-pill`; then **only the to_do + overdue steps** as
   `.attention` rows (`att-name` = step title, `att-meta` = type + "overdue {date}" /
   "to do"); done steps collapsed to the count. Certification badge line when
   `certification_badge` is a real URL.
5. **Footer** — wordmark + "My Onboarding · {Customer}".

**New CSS (additive ~8 lines).** The canonical sheet has no progress bar. Add a minimal
`.progress` (track) + `.progress > .bar` (fill, width set inline as `style="width:{pct}%"`,
brand-600) + a tone modifier (`.progress.red .bar` etc.) to the stylesheet. To keep the
five skill stylesheets byte-identical in body, add the same component to the canonical
sheet and re-sync all copies (additive, non-breaking).

Lightweight + mobile-first per the standing rule: no JS, no images (wordmark only),
fonts `display=swap` + preconnect + system fallback, fluid `clamp()` type, sections and
the progress bar reflow at 360px.

## 7. Anti-hallucination

- No internal IDs in output (`flow_id`, `flow_step_id`, `assignment_id`).
- `partner_id` from `list_accounts` (`type:'partner'`) only — never `partner_directory_search`.
- **Overall % = Σdone / Σtotal**, basis stated; zero-denominator → "—".
- Numerics arrive as strings → `Number()` before any math/sort.
- Detail lists are loose JSON-string concats → parse defensively (same posture as
  `referrals`); on parse failure, show the count, not a fabricated step list.
- `certification_badge` sentinels ("Not earned yet.", "No image attached.") → never
  render as an image/URL; show "badge earned" only when it's a real URL.
- "Overdue" only from the tool's `overdue_count` / `flow_due_date` — never inferred.
- Flag obvious test entries (placeholder flow titles); keep in counts.
- One partner + one customer per invocation.
- Read-only — never claim to have completed a step.

## 8. Files (folder-wrapped, self-contained)

```
skills/my-onboarding/
  SKILL.md
  references/account-gate.md        (partner-side variant of the shared gate)
  references/mcp-field-paths.md     (flow-tool field paths + JSON-concat quirks)
  assets/styles.css                 (canonical sheet + .progress component)
  assets/template.html
  examples/<sanitized>.md           (one sanitized run)
```

Plus, plugin-level: `marketplace.json` + `plugin.json` keywords (+ `onboarding`,
`certification`); **version bump 0.11.0 → 0.12.0**; README skill list.

## 9. Validation caveat

`partner_flow_details` (no-drill list) and `partner_flow_progress` response shapes are
written from the euler-mcp catalog + `docs/api-mapping/tools-by-function.md`, **not seen
live from this env → provisional.** First prod run validates; specifically confirm:
(a) the no-drill `partner_flow_details` payload field for the assigned-flow list +
title/type keys; (b) the exact `*_details` JSON-concat delimiter; (c) `flow_due_date`
format + `flow_due_in_days` sign for overdue. Read-only, so a wrong path only
mis-displays — never a bad write.

## 10. Evals

1. Partner mid-onboarding (some done, one overdue) → overall %, red tone, spotlight names
   the overdue step, per-flow bars, done collapsed.
2. Partner who finished a Certification → green, badge shown, "100% complete".
3. Customer-admin-only connection → friendly partner-required gate, no data, no raw code.
4. Partner with multiple customers → picks/asks which customer; one report for that pair.
5. Partner with zero assigned flows → positive "nothing assigned" empty state, no tables.
