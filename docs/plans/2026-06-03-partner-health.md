# partner-health (client-side shared model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one consistent partner-health model (0–100 score + band + factor breakdown), defined once in a canonical doc and applied by `generate-qbr` (full) and `portfolio-pulse` (coarse → deep-dive the tail).

**Architecture:** A single `docs/partner-health-model.md` is the source of truth (factors, weights, normalization thresholds, caps, bands, the cost-aware depth rule). Both skills' SKILL.md link to it and follow it verbatim — no new skill, no euler-mcp change. Pure prose/markdown; computed client-side by Claude from data the skills already fetch.

**Tech Stack:** Markdown (SKILL.md + model doc), Claude Code plugin. Quality gate: `claude plugin validate --strict` + structural greps (no pytest — content artifact).

**Spec:** [`docs/specs/2026-06-03-partner-health-design.md`](../specs/2026-06-03-partner-health-design.md). Read it first.

**Branch:** work on `dev`. Git account for push/PR: `kennedyeuler` (`gh auth switch --user kennedyeuler` if a 404 appears).

---

## File Structure

```
docs/partner-health-model.md            # NEW — canonical model (single source of truth)
skills/generate-qbr/SKILL.md            # MODIFY — "Status traffic light" section → partner-health full score
skills/portfolio-pulse/SKILL.md         # MODIFY — "Needs attention"/segmentation → coarse rank + deep-dive tail
.claude-plugin/plugin.json              # MODIFY — version bump
.claude-plugin/marketplace.json         # MODIFY — version bump (×2)
README.md                               # MODIFY — one-line note on the shared health model
```

---

## Task 1: Write the canonical model doc

**Files:**
- Create: `docs/partner-health-model.md`

- [ ] **Step 1: Write the file verbatim**

Create `docs/partner-health-model.md` with exactly this content:

````markdown
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
````

- [ ] **Step 2: Verify weights sum to 1.0 and the doc is complete**

Run:
```bash
cd /c/Users/Kenny/www/euler/EULER-skills
grep -nE '0\.35|0\.20|0\.15|0\.10' docs/partner-health-model.md | head
echo "weights: 0.35+0.20+0.20+0.15+0.10 = 1.00"
grep -c 'Healthy\|Watch\|At-risk\|Ramping' docs/partner-health-model.md
```
Expected: weights present; bands present.

- [ ] **Step 3: Commit**

```bash
git add docs/partner-health-model.md
git commit -m "feat(partner-health): add canonical shared health model"
```

---

## Task 2: Integrate the full score into `generate-qbr`

QBR already fetches all five factor sources, so this adds **zero** MCP calls. Replace its
ad-hoc traffic-light with the model's full score + band + breakdown.

**Files:**
- Modify: `skills/generate-qbr/SKILL.md`

- [ ] **Step 1: Read the current traffic-light + output sections**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
grep -nE 'traffic light|Status traffic|🟢|🟡|🔴|On track|At risk|hero-eyebrow|spotlight' skills/generate-qbr/SKILL.md
```
Read the `## Status traffic light` section and the hero/spotlight parts of `## Output format`.

- [ ] **Step 2: Replace the traffic-light section with the partner-health score**

Replace the `## Status traffic light (computed)` section (the table of green/amber/red rules)
with a section that defers to the model:

```markdown
## Partner health score (computed — see the shared model)

Compute the partner's health per [`docs/partner-health-model.md`](../../docs/partner-health-model.md)
in **full** mode (all 5 factors — you already fetch every source in the Orchestration sequence, so
this adds no extra calls). Produce: a **score 0–100**, a **band** (Healthy / Watch / At-risk /
Ramping), the **factor breakdown** (each factor's normalized value × weight = contribution), and
the **reason** (the 2–3 factors driving the score, plus any cap that fired).

Render:
- **Hero:** the score + band. Band → tone (per the model's tone mapping): At-risk → `red`,
  Watch → `amber`, Healthy / Ramping → default (brand). Show the band in the `hero-eyebrow`.
- **Spotlight:** the breakdown as the "why" — e.g. "Production 28/35 · Recency 3/10 (last
  activity 41d ago)" — and name any cap ("capped at Watch: 0 closed deals in Q1").

This replaces the old green/amber/red heuristic — `band` is now the single, model-consistent signal.
```

- [ ] **Step 3: Update any remaining traffic-light references in the output section**

```bash
grep -nE 'traffic light|On track|🟢 .On track|status pill.*green' skills/generate-qbr/SKILL.md
```
For each remaining mention of the old traffic-light vocabulary, point it at the band
(Healthy/Watch/At-risk/Ramping). Keep the `status-pill` classes (they still render the band).

- [ ] **Step 4: Verify the link + no contradictory inline weights**

```bash
grep -c 'docs/partner-health-model.md' skills/generate-qbr/SKILL.md   # expect ≥1
grep -nE 'class="(tldr|stats-grid|prio-badge|section-prose)"' skills/generate-qbr/SKILL.md || echo "no dead classes OK"
```
Expected: link present; `no dead classes OK`.

- [ ] **Step 5: Commit**

```bash
git add skills/generate-qbr/SKILL.md
git commit -m "feat(generate-qbr): health traffic-light -> shared partner-health score + breakdown"
```

---

## Task 3: Integrate the coarse rank into `portfolio-pulse`

**Files:**
- Modify: `skills/portfolio-pulse/SKILL.md`

- [ ] **Step 1: Read the current segmentation / needs-attention sections**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
grep -nE 'Needs attention|Segmentation|needs-attention|attention|At risk|status pill' skills/portfolio-pulse/SKILL.md
```
Read `## Segmentation` and the "Needs attention" output section.

- [ ] **Step 2: Replace the ad-hoc heuristic with the coarse model + deep-dive**

In the segmentation section, replace the ad-hoc "needs attention" derivation with:

```markdown
### Partner health (coarse rank → deep-dive the tail)

Score the portfolio per [`docs/partner-health-model.md`](../../docs/partner-health-model.md) in
**coarse** mode — Production (from `performance(action:'overall')`) + Status (from
`partners(action:'list')`), the two calls this skill already makes. Rank all partners by the
coarse score and segment by band (the hard-rule caps still apply: Inactive → At-risk, etc.).

Then **deep-dive only the bottom-K** (K ≈ 5, the at-risk/watch tail): fetch their per-partner
sources and upgrade them to a **full** score + a one-line reason for "Needs attention". Cap K so
the call budget stays small. **Label clearly** that the leaderboard is coarse-ranked and only the
tail was deep-scored — never imply every partner got the full model. Deep-link each at-risk row to
`/euler:generate-qbr <partner>` for the full picture.
```

- [ ] **Step 3: Update the "Needs attention" output rows to carry band + reason**

Ensure the needs-attention rows show the band pill (At-risk/Watch) + the deep-dived `top_reason`.
Keep existing `status-pill` / `att-row` classes.

- [ ] **Step 4: Verify the link + no dead classes**

```bash
grep -c 'docs/partner-health-model.md' skills/portfolio-pulse/SKILL.md   # expect ≥1
grep -nE 'class="(tldr|stats-grid|prio-badge|section-prose)"' skills/portfolio-pulse/SKILL.md || echo "no dead classes OK"
```
Expected: link present; `no dead classes OK`.

- [ ] **Step 5: Commit**

```bash
git add skills/portfolio-pulse/SKILL.md
git commit -m "feat(portfolio-pulse): needs-attention -> shared partner-health coarse rank + deep-dive"
```

---

## Task 4: Version bump, README, validate, PR

**Files:**
- Modify: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`

- [ ] **Step 1: Bump version 0.12.0 → 0.13.0**

In `.claude-plugin/plugin.json`: `"version": "0.12.0"` → `"0.13.0"`.
In `.claude-plugin/marketplace.json`: both `"version": "0.12.0"` occurrences → `"0.13.0"`.

- [ ] **Step 2: README note**

In `README.md`, add a one-line note under the skills list (or a short "Shared model" line):
that `generate-qbr` and `portfolio-pulse` share one health model documented in
`docs/partner-health-model.md`.

- [ ] **Step 3: Validate `--strict` + structural sweep**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate . --strict
grep -n '"version"' .claude-plugin/plugin.json .claude-plugin/marketplace.json   # all 0.13.0
for s in generate-qbr portfolio-pulse; do grep -q 'docs/partner-health-model.md' skills/$s/SKILL.md && echo "$s links model OK" || echo "$s MISSING link"; done
```
Expected: both `✔ Validation passed`; all `0.13.0`; both `links model OK`.

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md
git commit -m "chore(release): shared partner-health model wired into QBR + portfolio-pulse; v0.13.0"
```

- [ ] **Step 5: Push + PR**

```bash
gh auth switch --user kennedyeuler   # if needed
git push origin dev
gh pr create -R Euler-Software-Inc/EULER-skills --base main --head dev \
  --title "feat: shared partner-health model (QBR + portfolio-pulse) + v0.13.0" \
  --body "Adds docs/partner-health-model.md (single source of truth: 5 factors, weights, absolute normalization, caps, bands, cost-aware depth). generate-qbr uses the full score (zero extra calls); portfolio-pulse coarse-ranks then deep-dives the at-risk tail. Per docs/specs/2026-06-03-partner-health-design.md. Client-side, no euler-mcp change. Validated --strict."
```

- [ ] **Step 6: Confirm checks**

Run: `gh pr checks <PR#> -R Euler-Software-Inc/EULER-skills` (no required checks may be configured — that's fine).

---

## Notes for the implementer

- **No pytest.** The gate is `claude plugin validate --strict` + the greps above. A failing grep / non-`✔` validation is a red test.
- **Zero extra MCP calls in QBR** — it already fetches all five sources; the score is computed from data in hand. Do not add new orchestration calls to QBR.
- **portfolio-pulse stays cheap** — coarse rank from the 2 calls it already makes; only the bottom-K (~5) get deep-dived. Never loop all partners.
- **English-only** UI copy. Keep the existing design-system classes (no CSS change in this plan).
- The normalization thresholds in the model doc are **v1 tunable constants** — fine to adjust later in the one file; both skills inherit.
