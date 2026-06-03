# my-performance — design spec

> Date: 2026-06-03 · Status: approved design, pre-implementation.
> A new skill in the existing **`euler`** plugin (NOT a separate plugin — shares the
> partner-health model, no duplication). Second partner-facing skill (after `my-onboarding`).
> Companion: [`PLAN-account-aware-skills.md`](../../PLAN-account-aware-skills.md) (lists this as
> "my-performance — self-view mirror of QBR").

## 1. Purpose & audience

A partner sees **their own** performance with one customer — a fast self-service **scorecard**:
their EULER **health score** (0–100 + band) front-and-center, the key stats, and the **next lever
to improve**. Audience: **a partner** (PAM / partner-side user), NOT a customer admin. Read-only.

It is the partner-facing **mirror of `generate-qbr`**: same underlying signals, but the partner
views *themselves* (QBR is the partner manager reviewing a partner), partner-scoped, framed for
self-improvement, and lighter (a scorecard, not the full retrospective doc).

## 2. Account gate (partner-required — same pattern as `my-onboarding`)

`scope` effectively partner (uses `both`/partner-scope tools self-scoped). **Step 1 is
`list_accounts`.** Requires a `type === 'partner'` entry:
- No `type === 'partner'` entry (customer-only connection) → friendly message
  ("my-performance shows *your* numbers as a partner; you're connected as a customer admin —
  for a partner review use `generate-qbr`, or open your dashboard: `<dashboard_url>`") + STOP.
- Multiple partner accounts → pick by `affiliate_company_name`; ask only if ambiguous. One
  partner+customer per invocation.
- `partner_id` from the chosen `type:'partner'` entry only — never `partner_directory_search`
  (returns `profile_id` → `partner_not_in_consent`).

See [`references/account-gate.md`](../../skills/my-performance/references/account-gate.md)
(partner-side variant; adapt from `my-onboarding`'s).

## 3. Inputs (optional — never block)

| Input | Default | Accepts |
|---|---|---|
| Which customer | the only partner account; ask if >1 | a customer name → match `affiliate_company_name` |
| Time window | last 90 days | "this quarter", "last 30 days", "Q1 2026", explicit dates |

Window in `YYYY-MM-DD` (no time component). No partner is named — it's always the caller's own data.

## 4. Orchestration (self-scoped — the QBR subset, ~5–6 calls)

| # | Call | Provides |
|---|---|---|
| 1 | `list_accounts` | gate + `partner_id` + customer name (header) |
| 2 | `performance(action:'partner', partner_id, start_date, end_date)` | revenue, deals, win rate, sales cycle, ACV (window) |
| 3 | `partner_artifacts(action:'deals', partner_id)` | open pipeline (lifetime) |
| 4 | `commissions(action:'partner', partner_id, start_date, end_date)` | commissions earned (window) |
| 5 | `referrals(action:'for_partner', partner_id)` | referrals submitted (lifetime) |
| 6 | `partner_artifacts(action:'agreements', partner_id)` | agreements signed/pending |

These are the same signals the **health model** needs — so the score is computed from data already
in hand (no extra calls). Same backend gotchas as QBR (dates `YYYY-MM-DD`; numerics arrive as
strings; loose JSON on `referrals`). Field paths: [`references/mcp-field-paths.md`](../../skills/my-performance/references/mcp-field-paths.md).

### Error handling
Inherits the partner-skill posture: `partner_not_in_consent` → reconnect instructions; any tool
empty/errors → continue + footnote; `forbidden_scope` → the friendly gate message.

## 5. Partner-health (the synergy — the partner sees their OWN score)

Compute the partner's health per [`docs/partner-health-model.md`](../../docs/partner-health-model.md)
in **full** mode (data already fetched above; no extra calls). Use the exact 5 factors + weights
(Production 35 · Pipeline 20 · Engagement 20 · Foundation 15 · Recency 10), produce **score 0–100**
+ **band** (Healthy / Watch / At-risk / Ramping) + factor breakdown, and surface the **next lever**
= the lowest-contribution factor framed as an action ("Your biggest lift: Pipeline 8/20 — only
$18k open; the others are strong"). Caps apply verbatim. This is transparency — the partner sees
how their customer's health model reads them, and exactly what moves the number.

## 6. Output — modern Euler template (light scorecard, multilingual, wordmark)

Own copy of the canonical `styles.css` (text wordmark). Structure:
1. **Topbar** — "My Performance · {Customer}".
2. **Hero** — eyebrow tone by band; h1 "Your performance — `<accent>{score}/100</accent>` ({band})";
   subtitle (one-line read) + `.data-pill`; `.quick-facts`: **Revenue · Deals · Commissions · Referrals** (window).
3. **Spotlight** (tone by band) — the read + the **next lever** (lowest factor + the concrete move).
4. **Sections** (kept light): `01 · Health breakdown` (the 5 factors, `.progress` bar + value/weight);
   `02 · Pipeline` (top open deals); `03 · Commissions` (earned, window — conditional); `04 · Referrals`
   (count + most recent — conditional); `05 · Agreements` (status — conditional, surface unsigned).
5. **Footer** — "My Performance · {Customer}".

**Language — multilingual:** render all copy in the language the user requested (a Portuguese
request → `<html lang="pt-BR">`); proper nouns/currency/values/dates as-is. (SKILL.md + CSS stay English.)
Lightweight + mobile-first per the standing rule (no JS, no images beyond the wordmark, fluid type).

**Tone:** second person ("you/your"), encouraging but honest — it's the partner looking at themselves.

## 7. Anti-hallucination

- No internal IDs in output. Numerics-as-strings → `Number()`. Currency normalization.
- `partner_id` from `list_accounts` (`type:'partner'`) only.
- Health: use the exact 5 factors/weights/caps from the model doc — never rename/drop/invent (no "Compliance"); show the 0–100 number; a factor with no data contributes 0.
- Zero-denominator collapse (win rate/cycle/ACV omitted when 0 deals in window).
- Aging/recency only from real parseable dates; the deals `last_stage_change_date` ≥9999d sentinel is garbage — ignore.
- Flag obvious test-data (placeholder names) but keep in counts.
- One partner+customer per invocation. Read-only — never claim to have changed anything.

## 8. Files (folder-wrapped, in the euler plugin)

```
skills/my-performance/
  SKILL.md
  references/account-gate.md        (partner-side gate — adapt from my-onboarding)
  references/mcp-field-paths.md     (self-scoped performance/commissions/referrals/agreements paths)
  assets/styles.css                 (canonical sheet copy — incl. .progress)
  assets/template.html
  examples/<sanitized>.md
```
Plus: `plugin.json` + `marketplace.json` keywords (+ partner self-service); version bump; README.

## 9. vs `generate-qbr` (no duplication)

| | my-performance | generate-qbr |
|---|---|---|
| Audience | the partner (self) | customer admin reviewing a partner |
| Gate | partner-required | customer-admin |
| Scope | partner's own data (self) | any of the customer's partners |
| Framing | "you/your", self-improvement | third-person review, shareable doc |
| Weight | light scorecard | full retrospective |
| Health | the partner's own score + next lever | the same model, reviewer's view |

Both follow the same `partner-health-model.md` — consistent score, different lens.

## 10. Decomposition (the rest of the partner family — later cycles)

This delivers `my-performance` only. Future siblings, each its own spec→plan→build:
`my-referrals` + `submit-a-referral` (write ✍️), `my-deals`, `my-tracking-links` (`create_tracking_link`).
`my-onboarding` stays where it is (already shipped in the euler plugin).

## 11. Evals

1. Partner with solid production but thin pipeline → score reflects it; spotlight names Pipeline as the next lever.
2. Customer-admin-only connection → friendly partner-required gate, no data, no raw code.
3. Partner with multiple customers → picks/asks which; one scorecard for that pair.
4. Zero-data / brand-new partner → score 0 (or Ramping if pre-production status), encouraging empty state, never an error.
5. Portuguese request → Portuguese scorecard (`lang="pt-BR"`), health factor labels localized, weights intact.
6. Health section uses the exact 5 model factors + shows the 0–100 number (no improvised variant).
