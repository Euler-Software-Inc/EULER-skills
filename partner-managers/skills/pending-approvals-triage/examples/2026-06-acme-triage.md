# Example — pending-approvals-triage output (sanitized, illustrative)

> Fictional data. The *content* a rendered triage worklist would carry, written
> before live-MCP validation — shapes illustrative, not field-verified.

**Prompt:** "What's waiting on me to approve?"

**Customer:** Acme PRM · Data: partial

---

**10 items waiting — the oldest has been sitting 23 days.**
Two partner applications and a referral are past the 14-day line. Clear the 23-day
referral from BlueByte first — it's the most overdue and blocks their first deal.

### At a glance
| Total pending | Partner apps | Referrals | Deal regs | Oldest wait |
|---|---|---|---|---|
| 10 | 2 | 5 | 3 | 23d |

### Worklist (oldest first)
| Age | Type | Item | Waiting since | Action |
|---|---|---|---|---|
| 🔴 23d | Referral | BlueByte Innovations | May 9, 2026 | Approve in dashboard |
| 🔴 18d | Partner app | Cobalt Circuit Labs | May 14, 2026 | Approve in dashboard |
| 🔴 15d | Deal reg | EchoRise — Globex renewal | May 17, 2026 | Approve in dashboard |
| 🟡 11d | Referral | Axion DataWorks | May 21, 2026 | Approve in dashboard |
| 🟡 8d | Partner app | Lumon Industries | May 24, 2026 | Approve in dashboard |
| 🟢 4d | Referral | Primetime Video | May 28, 2026 | Approve in dashboard |
| … | … | … | … | … |

*Note: read-only — approvals happen in the dashboard. One entry ("UUU") looks like a
test submission; flagged, kept in counts. Two items had no parseable submitted date
and are listed last with age "—".*
