# pending-approvals-triage — design spec

> Date: 2026-06-01 · Status: approved design, pre-implementation.
> Skill for the EULER-skills plugin. Companion plan:
> [`PLAN-account-aware-skills.md`](../../PLAN-account-aware-skills.md).

## 1. Purpose & audience

A prioritized worklist of everything **awaiting a customer admin's approval** —
partner applications, pending referrals, and pending deal registrations — in one
age-sorted queue you work top-down. Audience: **customer admin / partner manager**.
Read-only: it surfaces + prioritizes the queue and deep-links to the dashboard to
approve; it does NOT approve (that would be a write tool).

## 2. Account gate

`scope: customer`. **Step 1 is `list_accounts`.** Apply the convention in
[`references/account-gate.md`](references/account-gate.md): no `type==='customer'`
entry → friendly message ("pending-approvals-triage is for customer admins; your
connection is a partner account — open your dashboard: `<dashboard_url>`") and STOP.
Translate any escaping `forbidden_scope` into the same message.

## 3. Inputs (optional)

| Input | Default | Accepts |
|---|---|---|
| Type filter | all three queues | "only referrals", "only deal registrations", "partner approvals only" |

No date window — pending = current state; "age" is the time each item has been waiting.

## 4. Orchestration (~4 calls)

1. `list_accounts` → customer name (header) + gate.
2. `partners(action: 'pending')` → partner applications awaiting approval.
3. `referrals(action: 'search', os_referral_type: 'Referral', filter_status: 'pending')`
   → referrals awaiting review. (`os_referral_type` is required for `search`.)
4. `referrals(action: 'search', os_referral_type: 'Deal Registration', filter_status: 'pending')`
   → deal registrations awaiting review.

`filter_status` matches Bubble literally — use the exact lowercase `pending`.
Any queue empty/erroring → continue; footnote the gap.

## 5. Triage logic (age / SLA)

- Compute each item's **waiting age** from its `"Submitted On"` date (referrals).
  For partner applications, use an applied/created date if present; if none, list
  without an age and say so (verify field on first run).
- Merge all three types into ONE worklist, **oldest-first**, each row tagged with its
  type (Partner app / Referral / Deal reg).
- SLA color by age: 🔴 > 14 days · 🟡 7–14 · 🟢 < 7. (Tunable; age-based, cheap.)
- Per-queue counts + the single oldest wait feed the hero.
- **Empty state:** if all three queues are empty → a positive "Inbox zero" spotlight.

## 6. Output — Euler design system (modern, lightweight, responsive)

Reuse the portfolio-pulse treatment (own copy of `styles.css`): topbar (Euler **text
wordmark**, no image) → hero (eyebrow tone by severity + headline like "12 items
waiting — oldest 23 days" + `.quick-facts`: Total · Partner apps · Referrals · Deal
regs · Oldest wait) → `.spotlight` (what to clear first + the most-stuck item) →
`01 · Worklist` unified `.table-wrap` (Age · Type tag · Item · Waiting since · Action
deep-link, oldest-first) → footer wordmark.

Lightweight + mobile-first per the standing rule: no JS, no images (wordmark only),
fonts via `display=swap` + preconnect + system fallback, fluid `clamp()` type, table
scrolls on narrow screens. Works at 360px.

## 7. Anti-hallucination

- No internal IDs in output.
- Age only from a real parseable date; if absent show "—" / "date n/a", never fabricate.
- **Read-only — never claim to have approved anything.** Action = deep-link to the
  dashboard.
- `filter_status: 'pending'` is a literal Bubble match (exact lowercase).
- Flag obvious test entries (placeholder names); keep in counts.
- Silence empty queues; "Inbox zero" when all empty.

## 8. Files (folder-wrapped, self-contained)

```
skills/pending-approvals-triage/
  SKILL.md
  references/account-gate.md
  references/mcp-field-paths.md
  assets/styles.css      (own copy of the modern lightweight stylesheet)
  assets/template.html
  examples/<sanitized>.md
```

## 9. Validation caveat

Response shapes for `partners(action:'pending')` and
`referrals(action:'search', filter_status:'pending')` were not seen live from this
env → **provisional** (written from the euler-mcp catalog). First prod run validates;
specifically confirm whether `partners(pending)` carries an applied/created date for
the age calc. Read-only, so a wrong path only mis-displays.

## 10. Evals

1. Customer with a backlog → full age-sorted worklist, SLA colors, per-queue counts.
2. Partner-only connection → friendly gate message, no data, no raw error code.
3. All queues empty → "Inbox zero" positive state, no empty tables.
