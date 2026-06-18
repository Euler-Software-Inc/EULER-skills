# Example — my-performance output (sanitized, illustrative)

> **Illustrative — refresh against a real run.**

**Prompt:** "How am I doing with Martus this quarter?"

**Partner:** Lumon Industries · Customer: Martus · Window: last 90 days (2026-03-06 → 2026-06-03)

---

## Call sequence

1. `list_accounts` → one `type:'partner'` entry, `affiliate_company_name = "Lumon Industries"`;
   `partner_id` resolved from that entry. Gate passes (partner role). "This quarter" →
   `start_date: "2026-03-06"`, `end_date: "2026-06-03"`.
2. `performance(action:'partner', partner_id, start_date, end_date)` → window: 2 deals closed,
   `closed_won_revenue: "$28,000"`, `win_rate: "40%"`, `avg_sales_cycle_days: "32"`,
   `acv: "$14,000"`.
3. `partner_artifacts(action:'deals', partner_id)` → open pipeline: 3 open deals totalling
   `$44,000` (largest: "Enterprise expansion" `$22k`, In Negotiation; next: "New seat add-on"
   `$15k`, Proposal Sent; smallest: "Renewal" `$7k`, Discovery).
4. `commissions(action:'partner', partner_id, start_date, end_date)` → 1 commission paid:
   `$3,360` (20% on $16,800 deal, paid 2026-04-11).
5. `referrals(action:'for_partner', partner_id)` → 5 lifetime referrals; most recent submitted
   `2026-05-14` (~20 days ago). No placeholder names detected.
6. `partner_artifacts(action:'agreements', partner_id)` → 1 agreement: MNDA, `Status: "Active"`,
   `Signed On: "2025-10-03"`. No unsigned foundational agreement — Foundation cap does NOT fire.

---

## Health score computation

| Factor | Raw → normalized | Score |
|---|---|---|
| Production | $28k closed-won (2 deals) — above $25k threshold | **22 / 35** |
| Pipeline | $44k open — below $80k threshold → 55% of weight | **8 / 20** |
| Engagement | 5 referrals lifetime + recency 20 days (strong) | **16 / 20** |
| Foundation | MNDA signed (foundational agreement present, no unsigned) | **15 / 15** |
| Recency | Most recent activity ~20 days ago → above 30-day cutoff but below 7 | **3 / 10** |
| **Total** | | **64 / 100 — Watch** |

No cap fired (Foundation is satisfied; partner has lifetime closed-won).

**Next lever = Pipeline** (lowest contribution: 8/20 = 40% of weight). Concrete move:
"Add $36k more open pipeline to cross the $80k threshold — that alone lifts Pipeline from 8 to 20."

---

## Rendered scorecard — key decisions

**Tone:** `amber` (Watch band). Hero eyebrow, spotlight, and progress bars for low factors use
the amber tone class; high-scoring bars (Engagement, Foundation) use `green`.

**Hero**

- Eyebrow: "Last 90 days · Watch"
- `<h1>`: "Your performance — **64/100** (Watch)"
- Subtitle: one-line read + `.data-pill` "complete" (all 6 calls succeeded)
- `.quick-facts` (4 pills): Revenue **$28k** / Deals **2** / Commissions **$3,360** / Referrals **5**
  (win rate, ACV, and sales cycle shown — deals > 0, so zero-denominator rule does not collapse them)

**Spotlight** (amber)

"You're in Watch territory — your Engagement and Foundation are strong, but Pipeline is holding
the score back. Your biggest lift: Pipeline **8/20** — $44k open is solid, but getting to
$80k open unlocks the full 20 points."

**01 · Health breakdown** — five `.progress` bars

| Factor | Value / Weight | Bar width | Tone |
|---|---|---|---|
| Production | 22 / 35 | 63% | amber |
| Pipeline | 8 / 20 | 40% | amber |
| Engagement | 16 / 20 | 80% | green |
| Foundation | 15 / 15 | 100% | green |
| Recency | 3 / 10 | 30% | red |

`.note` under Recency: "Last activity was ~20 days ago — consistent deal or referral activity
every week keeps this near 10."

**02 · Pipeline** — top-3 open deals (all 3 shown; no overflow footnote needed)

| Deal | Stage | Amount |
|---|---|---|
| Enterprise expansion | In Negotiation | $22,000 |
| New seat add-on | Proposal Sent | $15,000 |
| Renewal | Discovery | $7,000 |

**03 · Commissions** (last 90 days)

`.note`: "Earned in this window: $3,360 (1 payout — 20% on a $16,800 deal, 2026-04-11)."

**04 · Referrals** (lifetime)

`.note`: "5 referrals submitted lifetime; most recent 2026-05-14 (~20 days ago). No
test-data entries detected."

**05 · Agreements**

| Status | Agreement | Signed |
|---|---|---|
| 🟢 Active | MNDA | 2025-10-03 |

**Footer** — `brand-mark footer-mark` "Euler" + "My Performance · Martus" + `.mono` "euler · my-performance"

---

*Note: read-only — this skill surfaces numbers; it never submits a referral, registers a
deal, or changes an agreement status.*
