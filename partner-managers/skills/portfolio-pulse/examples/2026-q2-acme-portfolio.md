# Example — portfolio-pulse output (sanitized, illustrative)

> Fictional data. This is the *content* a rendered portfolio-pulse HTML would
> carry — written before live-MCP validation, so treat shapes as illustrative,
> not field-verified. Names/amounts are invented.

**Prompt:** "How's my partner portfolio doing this quarter?"

**Customer:** Acme PRM · **Window:** 2026-04-01 → 2026-06-30 · **Partners:** 42 · Data: complete

---

**Portfolio is producing but concentrated — $1.24M closed-won this quarter, 62% from the top 3.**
Strong top end (Lumon, Axion, Cobalt carrying the book), but 13 of 42 partners produced nothing in the window and 8 are inactive — a long tail worth triaging.

### Portfolio at a glance
| Partners | Producing (window) | Closed-won revenue | Top-partner concentration |
|---|---|---|---|
| 42 | 11 of top-25 ranked | $1,240,500 | 31% (Lumon Industries) |

### Top performers
| # | Partner | Revenue | Deals |
|---|---|---|---|
| 1 | Lumon Industries | $384,000 | 6 |
| 2 | Axion DataWorks | $271,500 | 4 |
| 3 | Cobalt Circuit Labs | $118,000 | 3 |
| 4 | EchoRise Labs | $96,250 | 2 |
| 5 | BlueByte Innovations | $74,000 | 2 |

### Needs attention
- 🔴 **At risk** · Primetime Video — active, $0 closed-won in window, no ranked deals · *Run /euler-for-partner-managers:generate-qbr for Primetime Video to diagnose.*
- 🔴 **Inactive** · Helix Systems — status Inactive · *Decide: reactivate or offboard.*
- 🟡 **Watch** · 7 partners in Onboarding with no first deal · *Push activation milestones (first referral / first registered deal).*

### Status distribution
Active 18 · Onboarding 9 · Prospecting 7 · Inactive 8

---

*Note: "revenue" here is closed-won deal revenue for the window (does not include
commissions or invoiced amounts). "Producing" is scoped to the top-25 ranked
partners returned — not necessarily the full 42 (pending live-MCP validation of
the overall-ranking total).*
