# portfolio-pulse — design spec

> Date: 2026-06-01 · Status: approved design, pre-implementation.
> Skill for the EULER-skills plugin (orchestrates the euler-mcp connector).
> Companion plan: [`PLAN-account-aware-skills.md`](../../PLAN-account-aware-skills.md).

## 1. Purpose & audience

A one-screen "pulse" of a customer's **entire partner portfolio** — the
multi-partner roll-up that `generate-qbr` and `partner-briefing` explicitly
refuse (those are per-partner). Audience: **customer admin / partner manager**.
Read-only. Output: a single self-contained HTML artifact.

Job-to-be-done (balanced pulse): in 30 seconds, see portfolio totals, top
performers, who needs attention, and coverage gaps — then deep-link into a QBR
for any partner that warrants depth.

## 2. Account gate (first application of the convention)

`scope: customer`. **Step 1 is always `list_accounts`.**

- Connected account has a `type === 'customer'` entry → proceed (customer context).
- No customer entry (partner-only connection) → emit a friendly message and STOP,
  do NOT proceed into a `forbidden_scope`:
  > "portfolio-pulse is for customer admins / partner managers. Your EULER
  > connection is a partner account — try `my-performance` for your own data, or
  > open your dashboard: `<dashboard_url from list_accounts>`."
- If `forbidden_scope` ever escapes mid-run (defense-in-depth), translate
  `required_scope` + `token_roles` into the same friendly message. Never surface
  the raw code.
- `backend_data_issue` on `list_accounts` → surface its `support_email`, continue
  with whatever other tools return.

## 3. Inputs (all optional)

| Input | Default | Accepts |
|---|---|---|
| Window | last 90 days (today−90 → today) | "this quarter", "last 30 days", "Q1 2026", explicit dates. Emit as `YYYY-MM-DD`. |
| Ranking metric | `revenue` | "by deals" → `deals` |
| Top N | 10 | any N (maps to `limit`) |

No `partner_id` — this is the whole book.

## 4. Orchestration (Approach A — ~5 fixed calls, no per-partner loop)

1. `list_accounts` → customer `name` (header) + gate.
2. `partners(action: 'summary')` → company-wide status distribution + totals.
3. `performance(action: 'company', start_date, end_date)` → own-company aggregate
   (sales / deals / charges) for portfolio totals context.
4. `performance(action: 'overall', entity_key, start_date, end_date, page: 1, limit: N)`
   → ranked top partners + aggregate metrics in one terminal call (won deals only,
   no commissions).
5. `partners(action: 'list', page, limit)` → roster (name + status) to derive the
   at-risk segment. Page through up to a cap (e.g. 100 partners) and note if truncated.

If any single call errors/returns empty → continue; footnote the gap (don't abort).

## 5. Segmentation (cheap signals only — no per-partner deep fetch)

- **Portfolio totals** (from summary + company): partner count, status mix,
  revenue/deals in window.
- **Top performers** (from overall): top N by chosen metric, with deal count.
- **Needs attention** (from `partners(list)` status + ranking absence):
  - Inactive partners (status `Inactive`).
  - Active partners with zero production in the window (active but absent from the
    won-ranking / zero revenue).
  - Large Onboarding/Prospecting cohort (activation backlog).
  - Each row: status pill + name + reason (from the cheap signal) + one action +
    deep-link suggestion ("run `/euler:generate-qbr` for <partner>").
- **Coverage gaps**: % producing vs dormant; concentration (top partner = X% of
  ranked revenue → concentration risk).
  > Precision note: "producing count" depends on `overall`'s response shape —
  > whether it returns a `total_items`/all-producers count or only the top-N page.
  > If only top-N, label as "top-N producing" or raise `limit` to cover the
  > producing cohort. Finalized during the §9 validation pass.

## 6. Output — Euler design system (self-contained HTML)

Anchored on the **Euler design system** (loaded via `/design-system`). Reuse the
shared stylesheet (own copy in the skill for self-containment); it already encodes
the tokens: Inter 400–700, Brand-600 `#2563EB`, two-layer shadows, radius-md
tables / radius-xl cards / radius-full pills. No improvised colors or fonts.

Component mapping (design-system → markup):
- Header + brand accent stripe (Brand-600) + data-confidence pill.
- **Alert/Callout** (`.tldr`, Warning/Error tone): portfolio state + the number
  that matters + biggest risk.
- **Stats/Widgets** (`.stats-grid`): total partners · active · producing-in-window ·
  revenue (window) · top-partner concentration.
- **Table** (`.table`, compact): "Top performers" — rank, partner, revenue, deals.
  Rank #1 accented with Brand-600.
- **Needs attention**: **List Item** rows (`.row`) with **Status** pill
  (Default/Success/Warning/Error/Feature) + reason + action.
- **Status distribution** mini-breakdown (Status pills + counts).
- Section omission: silence empty sections (no "No X" placeholders).

## 7. Anti-hallucination rules (inherited from QBR + portfolio-specific)

- No internal IDs in output (partner_id, etc.).
- Currency normalization: `""`/`"$"`/`"$0"` → `$0`; thousand separators on non-zero.
- All numerics arrive as strings → parse before computing.
- **`overall` ranks by closed-won deals only, no commissions** → label revenue as
  "closed-won revenue (window)"; never conflate with commissions/invoices.
- At-risk reasons limited to the cheap signals (status + zero-production). No
  "stalled N days" / aging claims at portfolio level (no per-partner aging data).
- Label window-filtered (overall, company) vs current-state (summary, list).
- Test-data heuristic: flag obvious test partners (placeholder names), don't filter.
- Account-type gate message per §2.

## 8. Files (folder-wrapped, self-contained)

```
skills/portfolio-pulse/
  SKILL.md                       (router + orchestration + rules; < 500 lines)
  references/mcp-field-paths.md  (overall / company / summary / list shapes)
  assets/styles.css              (own copy of the design-system stylesheet)
  assets/template.html           (portfolio skeleton)
  examples/<sanitized>.html + .md
```

## 9. Validation caveat (must close before trusting in prod)

Field paths for `performance(overall)`, `performance(company)`, and
`partners(summary)` are **NOT** in the existing field-paths reference (which only
documents per-partner shapes) and were not empirically verified from this
environment (no live MCP access here). They will be written best-effort from
`euler-mcp/docs/api-mapping/tools-by-function.md` and marked **provisional**.
The prod test IS the validation pass: read-only, so a wrong field path = wrong
display (no side effects), corrected by inspecting a real response. Aligns with
CONTRIBUTING "validate against the live MCP before merging".

## 10. Testing / evals (best practices: ≥3, validate live)

1. Customer with many partners → full balanced pulse renders.
2. Partner-only connection → friendly gate message, no data, no raw `forbidden_scope`.
3. Small/empty portfolio → empty sections silenced, no placeholders.
Plus: validate the §9 field paths against a real connector response on first prod run.
```
