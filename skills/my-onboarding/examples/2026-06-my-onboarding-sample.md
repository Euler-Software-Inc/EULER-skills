# Example — my-onboarding output (sanitized, illustrative)

> Illustrative — `partner_flow_*` response shapes are provisional (see spec §9 /
> references/mcp-field-paths.md); refresh against a real run once available.

**Prompt:** "Where am I in my onboarding?"

**Partner:** Lumon Industries · Flows assigned: 3

---

## Call sequence

1. `list_accounts` → one `type:'partner'` entry, `affiliate_company_name = "Lumon Industries"`;
   `partner_id` resolved from that entry. Gate passes.
2. `partner_flow_details(partner_id)` (no drill) → 3 assigned flows returned:
   - `flow_id: f-001` "Partner Onboarding" · type: Onboarding
   - `flow_id: f-002` "Solutions Certification" · type: Certification
   - `flow_id: f-003` "2026 Product Updates" · type: Custom To-Do
3. `partner_flow_progress(partner_id, flow_id: f-001)` → `done_count: 8`, `total_steps: 8`,
   `overdue_count: 0`, `percent_complete: "100"` — **Done** 🟢
4. `partner_flow_progress(partner_id, flow_id: f-002)` → `done_count: 6`, `total_steps: 10`,
   `overdue_count: 1`, `percent_complete: "60"`, overdue step: "Submit demo recording"
   `flow_due_date: "2026-05-20"`, `certification_badge: "Not earned yet."` — **Overdue** 🔴
5. `partner_flow_progress(partner_id, flow_id: f-003)` → `done_count: 0`, `total_steps: 4`,
   `overdue_count: 0`, `percent_complete: "0"` — **Not started** ⚪

---

## Rendered report — key decisions

**Overall %** = Σ done / Σ total = (8 + 6 + 0) / (8 + 10 + 4) = **14/22 = 64%**
(not the average of per-flow percents: 53% would be wrong).

**Hero tone** → `red` (at least one flow is overdue).

**Quick facts**
| Flows assigned | Overall % | Overdue steps | Next due |
|---|---|---|---|
| 3 | 64% | 1 | Solutions Certification |

**Spotlight** (red) → "Complete the overdue step in Solutions Certification.
'Submit demo recording' was due 2026-05-20 — clear it to unlock the certification badge."

**Per-flow sections — order: overdue → in-progress → not-started → done**

| # | Flow | % | Tone | Notes |
|---|---|---|---|---|
| 01 | Solutions Certification | 60% | 🔴 red | 1 overdue step listed in `.attention` block |
| 02 | 2026 Product Updates | 0% | ⚪ (default) | No steps shown — `.attention` block empty; to-do count in header |
| 03 | Partner Onboarding | 100% | 🟢 green | Done steps collapsed to "8/8 complete" in header; no `.attention` rows |

**Certification badge line** → omitted for Solutions Certification (`"Not earned yet."` is
not a URL; rule §6). Line would appear only on a real badge URL.

**Done steps** → collapsed to count in each section header; never enumerated individually.

*Note: read-only — this skill surfaces progress; it never marks a step complete or
changes an assignment.*
