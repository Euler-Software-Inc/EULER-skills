# partner_health — design spec (euler-mcp tool proposal)

> Date: 2026-06-03 · Status: approved design, proposal for the **euler-mcp** team.
> Consuming skills (EULER-skills): `portfolio-pulse`, `generate-qbr`.
> Companion: onboarding follow-up in `docs/specs/euler-mcp-issue-onboarding-coverage.md`.

## 1. Purpose

An **authoritative partner health score**, computed **server-side inside the MCP**, so every
skill consumes one consistent number + factor breakdown instead of recomputing heuristics
client-side (today `portfolio-pulse` and `generate-qbr` each derive "needs attention" / the
traffic-light their own way, from many calls). Read-only. One score, one source of truth,
tunable centrally.

## 2. Tool contract

| | |
|---|---|
| `name` | `partner_health` |
| `scope` | `customer` |
| `annotations` | `readOnlyHint: true`, `openWorldHint: false` |
| actions | `partner` · `portfolio` |

- `partner_health(action: 'partner', partner_id, [start_date, end_date])` → one partner: score
  + band + full factor breakdown.
- `partner_health(action: 'portfolio', [start_date, end_date, page, limit])` → all partners
  ranked by score (compact: score, band, top_reason), paginated.
- Window: default **last 90 days** for window-based factors (production, engagement, recency);
  current-state factors (status, agreements) are not windowed. Dates `YYYY-MM-DD`.
- `partner_id` (for `action:'partner'`) resolves from `partners(action:'list', filter_name)` or
  `list_accounts`; never from `partner_directory_search` (that returns `profile_id`).

**Customer-facing `description` (clean — no internal vocabulary, goes to `tools/list`/public docs):**
> "Returns a 0–100 health score, a health band (Healthy / Watch / At-risk / Ramping), and the
> factor breakdown behind it — for one partner (`action: 'partner'`, requires `partner_id`) or
> for the whole portfolio ranked by score (`action: 'portfolio'`). Factors: production (closed
> revenue + deals), open pipeline, referral engagement, agreement foundation, and recency over
> the selected window. Use it to find which partners need attention and to explain why."

## 3. Output shape

`action: 'partner'`:
```json
{
  "partner_name": "Acme",
  "score": 72,
  "band": "Healthy",
  "window": { "start_date": "2026-03-05", "end_date": "2026-06-03" },
  "factors": [
    { "key": "production",  "weight": 0.35, "value_norm": 80, "contribution": 28, "detail": "$120k closed · 4 deals" },
    { "key": "pipeline",    "weight": 0.20, "value_norm": 60, "contribution": 12, "detail": "$90k open · 3 deals" },
    { "key": "engagement",  "weight": 0.20, "value_norm": 70, "contribution": 14, "detail": "5 referrals · last 12d ago" },
    { "key": "foundation",  "weight": 0.15, "value_norm": 100,"contribution": 15, "detail": "all agreements signed" },
    { "key": "recency",     "weight": 0.10, "value_norm": 30, "contribution": 3,  "detail": "last activity 41d ago" }
  ],
  "top_reason": "Strong production; pipeline cooling",
  "caps_applied": []
}
```
`action: 'portfolio'`: `[{ partner_name, score, band, top_reason }]`, ranked desc, paginated;
plus a small summary (counts per band).

## 4. Scoring model (hybrid — fixed v1 constants, documented)

**Composite (rankable number):** each factor normalized to 0–100, multiplied by its weight, summed → 0–100.

| Factor | Weight | Signal |
|---|---|---|
| Production | **0.35** | closed-won revenue + deal count in window |
| Pipeline / momentum | **0.20** | open pipeline value + count |
| Engagement | **0.20** | referrals submitted + recency in window |
| Foundation | **0.15** | agreements signed; unsigned **foundational** agreement = heavy penalty |
| Recency | **0.10** | days since last deal/referral (decay) |

`score = Σ(weight × value_norm)` → 0–100.

**Normalization (the main open implementation choice):** recommend **absolute documented
thresholds** per factor (e.g. production: a documented revenue + deal-count target maps to 100,
scaling linearly below) rather than portfolio-relative percentiles. Absolute keeps a partner's
score **stable and comparable over time** and across customers; percentile would make a score
drift as the roster changes. Exact thresholds are constants chosen with the team at build time
and documented alongside the weights.

**"Foundational agreement"** = MNDA / master / partner / agency agreement (same definition the
`generate-qbr` skill already uses) — an unsigned one at a partner with zero lifetime production
is the foundation penalty / cap trigger.

**Hard-rule band caps (override the score→band mapping):**
- `status = Inactive` → band **At-risk** (regardless of score).
- `status = Active` AND 0 production in window AND 0 lifetime closed-won → cap at **Watch** (can't be Healthy).
- foundational agreement unsigned AND 0 lifetime production → cap at **Watch**.
- `status ∈ {Onboarding, Prospecting}` → band reported as **Ramping** (low production is expected; not "at-risk").

**Band thresholds (after caps):** Healthy ≥ 70 · Watch 40–69 · At-risk < 40 · Ramping (status-driven).

Every cap that fires is listed in `caps_applied` so the consuming skill can explain it.

## 5. Data sources (internal mapping — existing MCP signals feed each factor)

| Factor | Existing signal |
|---|---|
| Production | `performance(action:'partner')` — closed revenue, deal count, win rate |
| Pipeline | `partner_artifacts(action:'deals')` — open stages + amounts |
| Engagement | `referrals(action:'for_partner')` — count + `Submitted On` recency |
| Foundation | `partner_artifacts(action:'agreements')` — `Status` / `Signed On` |
| Recency | derived from the latest deal / referral dates |
| Status (cap) | `partners(action:'list')` — Active/Onboarding/Prospecting/Inactive |

All signals already exist today — **no new data source required for v1.**

## 6. Compute it server-side in one step (internal guidance)

The score is computed **in a single server-side scoring operation that already has all the
partner data** — not by fanning out N calls from the skill/client. The weight constants and band
thresholds live server-side and are documented (§4). A skill makes **one** `partner_health` call
and renders the result. The catalog entry is a thin read tool over that single operation.

## 7. Known gap — onboarding completion

Per-partner onboarding **completion** is not available on the customer side today (it's
partner-scoped). v1 uses partner **status** (Onboarding/Active/…) as a coarse proxy via the
Ramping cap. Adding a real onboarding-completion factor depends on the customer-side flow tools
proposed in `euler-mcp-issue-onboarding-coverage.md` — a future weight, not a v1 blocker.

## 8. Privacy / scope

- `scope: customer`; filtered by the injected `company_id` (cross-tenant safe per the standard checklist).
- Identity from token props, never args. Read-only — no destructive surface.
- Numerics arrive as strings → coerce before math.
- Run the 4-point privacy audit before enabling.

## 9. Skill integration (after the tool ships)

- **portfolio-pulse:** replace the client-side "needs attention" heuristic with `partner_health(action:'portfolio')` — rank by score, segment by band, show `top_reason`. One call instead of the current fan-out.
- **generate-qbr:** drive the traffic-light from the partner's `band`, and surface the `factors` breakdown in the spotlight ("why this score"). Bump the plugin minor version when integrated.

## 10. Scope reality / deliverable

This tool lives in **euler-mcp** (catalog entry + the server-side scoring step) — it cannot be
fully shipped from the skills repo, and the scoring step + data access is the euler-mcp team's to
build. **Deliverable from here:** this design spec (hand-off proposal) + the skill-integration
plan (§9) for when the tool lands. We can additionally draft the thin catalog-entry shape for the
team if useful.

## 11. Acceptance / evals

- [ ] `action:'partner'` returns `score` + `band` + `factors[]` (with weights summing to 1.0) + `top_reason`, matching the documented formula on a known partner.
- [ ] Each hard cap fires correctly (Inactive→At-risk; Active+0-production→≤Watch; unsigned-foundational+0-lifetime→≤Watch; Onboarding/Prospecting→Ramping) and is listed in `caps_applied`.
- [ ] `action:'portfolio'` ranks desc by score, paginates, and returns per-band counts.
- [ ] The tool `description` passes the public-surface guard (no internal architecture vocabulary; observable behavior only).
- [ ] Zero-data partner → score 0 / band At-risk (or Ramping if pre-production status), never an error.

## 12. Draft catalog entry (hand-off — ready to paste into `src/catalog/tools.ts`)

The tool **contract** is fully specified below; the **scoring step + data access** behind the
two workflow names is the euler-mcp team's to build (and to empirically verify per the W1 rule).
Ships `enabled: false` + `requires_privacy_audit: true` until that step is wired and the 4-point
privacy audit is signed off — so it's catalogued for visibility but hidden from clients. Workflow
names are placeholders to confirm. `[Category]` prefix is added at registration, so the
description stays clean (no internal vocabulary — passes the public-surface guard).

```ts
// ─── Partner Health (READ) — authoritative per-partner health score ──────────
// PROPOSAL 2026-06-03 (see docs/specs/2026-06-03-partner-health-design.md).
// Single server-side scoring step over existing signals (performance /
// partner_artifacts / referrals / partner status). Weights + band thresholds are
// documented constants (spec §4). enabled:false + requires_privacy_audit:true
// until the scoring step is wired and the privacy audit is signed off.
{
  name: "partner_health",
  category: "partners",
  scope: "customer",
  description:
    "Returns a 0-100 health score, a health band (Healthy / Watch / At-risk / Ramping), and the factor breakdown behind it. action='partner' (requires partner_id) returns one partner's score plus the full factor breakdown; action='portfolio' returns every partner ranked by score (paginated). Factors: production (closed revenue + deals), open pipeline, referral engagement, agreement foundation, and recency over the selected window (default last 90 days). Use it to find which partners need attention and to explain why.",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["partner", "portfolio"] },
      partner_id: {
        type: "string",
        description:
          "Required for action='partner'. Resolve via partners(action:'list', filter_name) or list_accounts. IDs from partner_directory_search are profile_ids and are rejected.",
      },
      start_date: {
        type: "string",
        description: "YYYY-MM-DD. Window start for production / engagement / recency factors. Default: today - 90 days.",
      },
      end_date: { type: "string", description: "YYYY-MM-DD. Window end. Default: today." },
      ...PAGINATION_PROPS, // action='portfolio'
      ...MESSAGE_ID,
    },
    required: ["action"],
    additionalProperties: false,
  },
  annotations: {
    title: "Partner Health Score",
    readOnlyHint: true,
    openWorldHint: false,
  },
  routes: {
    partner:   { workflow: "tool_get_partner_health",   required: ["partner_id"] },
    portfolio: { workflow: "tool_get_portfolio_health", fixedParams: { page: "1", limit: "20" } },
  },
  requires_privacy_audit: true,
  enabled: false,
},
```

**When the team enables it (checklist for them):** wire the two workflows; flip `enabled: true`
+ `requires_privacy_audit: false` after the 4-point audit; bump `MIN_EXPECTED_TOOLS` +
`test/catalog.test.ts` counts; update `docs/api-mapping/*`; (READ tool → non-material, no
Directory re-cycle needed). Then we integrate it into `portfolio-pulse` + `generate-qbr` (§9).
