# Partner Health Model (shared)

> Single source of truth for the EULER partner-health score. `generate-qbr` and
> `portfolio-pulse` both follow this model verbatim. Update the model = edit this file.
> Client-side (computed by the skill from EULER MCP data); v1 constants are tunable.

## Score

Each factor is normalized to **0–100**, multiplied by its weight, and summed → **score 0–100**.

| Factor | Weight | Signal (EULER MCP) |
|---|---|---|
| Production | 0.35 | `performance(action:'partner')` — closed-won revenue + deal count in window |
| Pipeline | 0.20 | `partner_artifacts(action:'deals')` — open pipeline value |
| Engagement | 0.20 | `referrals(action:'for_partner')` — referrals submitted + recency |
| Foundation | 0.15 | `partner_artifacts(action:'agreements')` — foundational agreements signed |
| Recency | 0.10 | latest deal/referral date — days since last activity |

`score = 0.35·production + 0.20·pipeline + 0.20·engagement + 0.15·foundation + 0.10·recency`

Weights sum to 1.0. Window default: **last 90 days** for production / engagement / recency.

## Normalization (absolute thresholds — v1 tunable constants)

Absolute, NOT portfolio-relative — a partner's score is stable over time. `clamp(x)` = max(0, min(100, x)).

- **production** = clamp( 60·min(1, revenue/50000) + 40·min(1, deals/3) )
  — $50k closed-won AND 3 deals in window → 100.
- **pipeline** = clamp( 100·min(1, open_value/50000) ) — $50k open pipeline → 100.
- **engagement** = clamp( 60·min(1, referrals/3) + 40·recency_ref )
  where `recency_ref` = 1.0 if last referral < 30d, linearly → 0 at 120d, 0 beyond.
- **foundation** = 100 if every foundational agreement is signed; 60 if only non-foundational
  are pending; **0 if any foundational agreement is unsigned**.
  Foundational = MNDA / master / partner / agency agreement (same definition `generate-qbr` uses).
- **recency** = 100 if last activity (deal OR referral) < 14d; linearly → 0 at 120d; 0 beyond.
  (`recency = clamp( 100·(1 − (days − 14)/106) )` for days > 14, else 100.)

Numerics arrive as strings — `Number()` before any math. Treat `""`/`"$"`/`"$0"` as 0.

## Bands

| Band | Rule |
|---|---|
| Healthy | score ≥ 70 |
| Watch | 40 ≤ score < 70 |
| At-risk | score < 40 |
| Ramping | status ∈ {Onboarding, Prospecting} (reported instead of a number-band) |

## Hard-rule band caps (override the score → band mapping; first match wins)

1. `status = Inactive` → **At-risk**.
2. `status = Active` AND 0 production in window AND 0 lifetime closed-won → cap at **Watch** (never Healthy).
3. foundational agreement unsigned AND 0 lifetime closed-won → cap at **Watch**.
4. `status ∈ {Onboarding, Prospecting}` → **Ramping**.

List every cap that fires as the score's reason, so the skill can explain it
(e.g. "capped at Watch: 0 closed deals in 90d").

## Cost-aware depth (client-side)

- **Full** (all 5 factors): use when the per-partner data is already fetched — a single-partner
  view or `generate-qbr` (which already fetches all five sources). ~0 extra calls.
- **Coarse** (Production + Status only): for ranking a whole portfolio cheaply —
  `performance(action:'overall')` gives the revenue rank + aggregates in ONE call;
  `partners(action:'list')` gives status. Score ≈ production factor alone + status caps.
  Then **deep-dive only the bottom-K** (at-risk/watch tail) to upgrade them to a full score + reason.
- **Always label depth.** A coarse score must say it's coarse — never present a coarse rank as if
  every partner got the full model.

## Tone mapping (for the design-system output)

Band → `hero-eyebrow` / `spotlight` tone (the sheet has only default / `amber` / `red`):
At-risk → `red` · Watch → `amber` · Healthy / Ramping → default (brand).

## Anti-hallucination

- No internal IDs in output. Numerics-as-strings → coerce. Currency normalization.
- A factor with no data contributes 0 (never a fabricated value); the score's basis is stated.
- Recency only from real parseable dates. Flag obvious test-data partners but keep them in counts.
