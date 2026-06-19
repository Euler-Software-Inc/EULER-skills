# Example — my-referrals output (sanitized, illustrative)

> Illustrative — `referrals(action:'for_partner')` response shapes may shift;
> refresh against a real run once available.

**Prompt:** "What referrals have I submitted?"

**Partner:** Lumon Industries · Customer: Martus

---

## Call sequence

1. `list_accounts` → one `type:'partner'` entry, `affiliate_company_name = "Martus"`;
   `partner_id` resolved from that entry. Gate passes.
2. `referrals(action:'for_partner', partner_id)` → 6 referrals returned (single page).
   Parsed loosely (result_per_page quirk handled). Sorted most-recent first by `Submitted On`.

---

## Rendered report — key decisions

**Hero tone** → `amber` (3 pending, 2 approved, 1 rejected — some pending → amber).

**Quick facts**
| Total | Pending | Approved | Most recent |
|---|---|---|---|
| 6 | 3 | 2 | Dunder Mifflin · 2026-04-18 |

**Worklist (most-recent first)**

| Company | Type | Status | Submitted |
|---|---|---|---|
| Dunder Mifflin | Deal registration | 🟡 Pending | 2026-04-18 |
| Acme Corp | Referral | 🟢 Approved | 2026-04-01 |
| Initech | Referral | 🟡 Pending | 2026-03-22 |
| Umbrella Ltd | Deal registration | 🟢 Approved | 2026-03-15 |
| Parallax | Referral | 🟡 Pending | 2026-02-28 |
| test123 (test?) | Referral | 🔴 Rejected | 2026-01-10 |

**Status pill mapping applied:**
- "approved" → `status-pill green` 🟢 Approved
- "pending" → `status-pill amber` 🟡 Pending
- "rejected" → `status-pill red` 🔴 Rejected

**Test-data flag:** "test123" matches the placeholder heuristic (purely numeric suffix,
no real company name). Appended `(test?)` to the display name; counted in totals.
Footer footnote: "(1 entry flagged as possible test data — Lumon Industries can delete it
from the dashboard.)"

**CTA note** → "To submit a new referral, use `/euler-for-partners:submit-a-referral`."

**Footer** → `euler · my-referrals`

*Note: read-only — this skill surfaces referral status; it never submits a referral or
changes a status.*
