# partner-health — design spec (client-side shared model)

> Date: 2026-06-03 · Status: approved design, pre-implementation.
> **Decision:** build the health score **client-side** as a single shared model consumed by the
> existing skills — **no euler-mcp change, no new skill, no issue filed.**
> Server-side was considered but the per-partner signals are not exposed in an aggregated
> server-side form today; rather than block, we ship the same model client-side as the single
> source of truth. (If the data is ever exposed server-side, this model lifts into a tool unchanged.)
> Consuming skills: `generate-qbr`, `portfolio-pulse`.

## 1. Purpose

One **consistent partner-health model** — a 0–100 score, a band, and a factor breakdown —
defined **once** and applied by both skills, instead of each deriving "needs attention" / the
traffic-light its own ad-hoc way. The model is documented in a single canonical file; each skill
reads it and computes the score from data it already fetches.

## 2. The model (fixed v1 constants)

Each factor normalized 0–100, multiplied by its weight, summed → score 0–100.

| Factor | Weight | Signal |
|---|---|---|
| Production | **0.35** | closed-won revenue + deal count in window |
| Pipeline / momentum | **0.20** | open pipeline value + count |
| Engagement | **0.20** | referrals submitted + recency in window |
| Foundation | **0.15** | agreements signed; unsigned **foundational** agreement (MNDA / master / partner / agency) = heavy penalty |
| Recency | **0.10** | days since last deal/referral (decay) |

`score = Σ(weight × value_norm)` → 0–100.

**Normalization:** absolute documented thresholds per factor (e.g. production: a documented
revenue + deal-count target maps to 100, linear below) — NOT portfolio-relative percentiles, so a
partner's score is stable over time and comparable across runs. Thresholds are constants in the
model doc.

**Hard-rule band caps (override score→band):**
- `status = Inactive` → **At-risk**.
- `status = Active` AND 0 production in window AND 0 lifetime closed-won → cap at **Watch**.
- foundational agreement unsigned AND 0 lifetime production → cap at **Watch**.
- `status ∈ {Onboarding, Prospecting}` → band **Ramping** (low production expected).

**Bands (after caps):** Healthy ≥ 70 · Watch 40–69 · At-risk < 40 · Ramping (status-driven).
Each cap that fires is named in the output so the skill can explain it.

## 3. Cost-aware depth (the client-side rule)

Computing the full 5-factor score needs the per-partner deep calls (~6). That's cheap for one
partner, infeasible for a whole 40-partner portfolio (240+ calls). So the model is applied at the
depth the call budget allows:

- **Full** (all 5 factors): when the per-partner data is already in hand — a single-partner
  deep-dive, or `generate-qbr` (which already fetches all five sources). Zero or near-zero extra cost.
- **Coarse** (production + status only): for ranking a whole portfolio cheaply — `performance(action:'overall')`
  gives revenue rank + aggregates in ONE call; `partners(action:'list')` gives status. Then
  **deep-dive only the bottom-K** (the at-risk tail) to upgrade them to a full score + `top_reason`.
- Always **label** which depth produced a score (coarse scores say so) — never present a coarse
  rank as if every partner got the full model.

## 4. Factor → signal mapping (existing tools, no new data)

| Factor | Existing tool / signal |
|---|---|
| Production | `performance(action:'partner')` (full) / `performance(action:'overall')` (coarse rank) |
| Pipeline | `partner_artifacts(action:'deals')` — open stages + amounts |
| Engagement | `referrals(action:'for_partner')` — count + `Submitted On` recency |
| Foundation | `partner_artifacts(action:'agreements')` — `Status` / `Signed On` |
| Recency | derived from latest deal / referral dates |
| Status (cap) | `partners(action:'list')` — Active/Onboarding/Prospecting/Inactive |

## 5. Canonical location

`docs/partner-health-model.md` — the single source of truth (factors, weights, normalization
thresholds, caps, bands, the depth rule, the factor→signal map, anti-hallucination notes). Both
`generate-qbr` and `portfolio-pulse` SKILL.md link to it and follow it verbatim. Updating the
model = editing this one file.

## 6. `generate-qbr` integration (FULL score — zero extra calls)

QBR already fetches all five factor sources. Replace its **"Status traffic light"** section with
the partner-health model:
- Compute the full 0–100 score + band from the data already fetched.
- Hero: show the score + band. Band → existing tone classes: **At-risk → `red`**, **Watch →
  `amber`**, **Healthy / Ramping → default (brand)** — the shared stylesheet's `hero-eyebrow` /
  `spotlight` tones are only default / `amber` / `red` (there is no green tone), so a healthy
  partner reads as the calm default brand tone.
- Spotlight: the factor breakdown — the 2–3 factors driving the score, e.g. "Production 28/35,
  Recency 3/10 — last activity 41d ago" — as the "why".
- The old green/amber/red traffic-light heuristic is removed in favor of `band`. SKILL.md links §5.

## 7. `portfolio-pulse` integration (COARSE rank → deep-dive the tail)

Replace the ad-hoc **"needs attention"** heuristic with the model's coarse mode:
- Coarse-score + rank all partners from `performance(overall)` (production) + `partners(list)`
  (status) — the two calls portfolio-pulse already makes. Segment by band.
- Deep-dive only the **bottom-K** (at-risk / watch tail, K ~5) for a full score + `top_reason`,
  shown in "needs attention". Cap K so the call budget stays small; footnote that the tail was
  deep-scored and the rest are coarse. SKILL.md links §5.

## 8. Anti-hallucination

- No internal IDs in output.
- Numerics arrive as strings → `Number()` before math.
- Currency normalization (`""`/`"$"`/`"$0"` → `$0`; separators on non-zero).
- Overall score basis stated; zero-denominator factor → contributes 0, never a fabricated value.
- "Overdue"/recency only from real parseable dates; never inferred.
- Flag obvious test-data partners (placeholder names) but keep in counts.
- Label coarse vs full depth (§3).

## 9. Out of scope / future

- **Server-side tool** — if EULER ever exposes an aggregated server-side health endpoint, this
  exact model lifts into it; the skills then make one call instead of computing. Not now.
- **Onboarding-completion factor** — per-partner onboarding % isn't available customer-side
  (status is the proxy via the Ramping cap). A future factor if the customer-side flow data lands.
- No new skill; no euler-mcp change; no issue.

## 10. Files

```
docs/partner-health-model.md            # NEW — canonical model (single source of truth)
skills/generate-qbr/SKILL.md            # MODIFY — traffic-light → full partner-health score + breakdown
skills/portfolio-pulse/SKILL.md         # MODIFY — needs-attention → coarse rank + deep-dive tail
.claude-plugin/{plugin,marketplace}.json # MODIFY — minor version bump
README.md                               # MODIFY — note the shared health model (optional)
```

## 11. Acceptance / evals

- [ ] `docs/partner-health-model.md` fully specifies factors, weights (sum 1.0), absolute
      normalization thresholds, caps, bands, the depth rule, and the factor→signal map.
- [ ] `generate-qbr`: a partner with strong production but stale recency renders a mid score with
      the breakdown explaining it; an Inactive partner → At-risk regardless of score; weights/bands
      match the model doc; no extra MCP calls beyond what QBR already makes.
- [ ] `portfolio-pulse`: coarse rank over all partners from 2 calls; only the bottom-K deep-scored;
      output labels coarse vs full; bands segment the roster.
- [ ] Both SKILL.md link `docs/partner-health-model.md` and contain no contradictory inline weights.
- [ ] `claude plugin validate --strict` passes; stylesheets unchanged (no CSS in this change).
