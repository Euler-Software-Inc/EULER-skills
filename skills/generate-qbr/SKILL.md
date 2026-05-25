---
name: generate-qbr
description: Generate a Quarterly Business Review (QBR) document for a specific partner using EULER MCP tools. Use when the user asks for a QBR, quarterly review, partner business review, or quarterly performance summary tied to a partner.
---

# Generate QBR — Quarterly Business Review for a partner

## When to use this skill

Invoke this skill when the user types any of:

- "QBR for <partner>"
- "Quarterly review of <partner>"
- "Generate Q<N> business review for <partner>"
- "Make a quarterly summary for <partner>"
- `/euler:generate-qbr`

DO NOT invoke for:

- Company-wide reviews (use `performance(action: 'company')` directly)
- Customer-level QBRs (different audience, different metrics)
- Non-partner accounts

## Inputs needed from user

Before running, confirm with the user:

### 1. Which partner?

- Accept either a partner name or a `partner_id`.
- If only a name is given, run `list_accounts` first and match against
  `affiliate_company_name` (case-insensitive) to resolve the `partner_id`.
- If multiple matches, list them and ask the user to pick.
- If no match, tell the user the partner isn't in their approved consent
  list — they need to disconnect + reconnect and re-select.

### 2. Which quarter?

- Accept any of: `"Q1 2026"`, `"Q4 2025"`, explicit ISO dates, `"last quarter"`,
  `"this quarter"`.
- Convert to `start_date` / `end_date` in ISO format (`YYYY-MM-DD`):
  - Q1 = Jan 1 – Mar 31
  - Q2 = Apr 1 – Jun 30
  - Q3 = Jul 1 – Sep 30
  - Q4 = Oct 1 – Dec 31
- If `"last quarter"` or ambiguous, infer from today's date and **CONFIRM with
  the user before proceeding**. Never silently guess.

## Orchestration sequence

Run these EULER MCP tools in order. Default to running them all for a
standard QBR. Skip a step only if the user's framing explicitly excludes it
(e.g. "QBR without commissions").

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Resolves `partner_id` (skip if user provided). Also fetches the customer-side `name` for the header. |
| 2 | `performance(action: "partner", partner_id, start_date, end_date)` | Headline metrics: revenue, deal count, ranking. |
| 3 | `partner_artifacts(action: "deals", partner_id, page: 1, limit: 20)` | Pipeline + top deals for the period. |
| 4 | `commissions(action: "partner", partner_id, start_date, end_date)` | Commissions paid + breakdown. |
| 5 | `partner_artifacts(action: "referrals", partner_id, page: 1, limit: 20)` | Referral volume + status. |
| 6 | `partner_artifacts(action: "agreements", partner_id)` | Agreement status + renewal dates. |
| 7 | `partner_artifacts(action: "invoices", partner_id, page: 1, limit: 20)` | Billing snapshot. Include only if there were invoices in the period. |

### Error handling during orchestration

- **`partner_not_in_consent`** → abort. Tell the user to disconnect + reconnect
  and include this partner in their consent selection. Do not generate a partial
  QBR.
- **`backend_data_issue`** on `list_accounts` → abort. Surface the
  `support_email` from the response.
- **`euler_session_expired` / `euler_user_token_missing`** → instruct the user
  to follow Claude's inline reconnect prompt, then retry.
- **Any single tool returning empty data mid-sequence** → continue. The output
  format handles missing sections gracefully (see anti-hallucination rule 1).

## Output format

Render a single markdown document. Use this exact structure:

```markdown
# Q<N> <Year> — <Partner name> × <Customer name>

**Period:** <start_date> to <end_date>
**Partner ID:** `<partner_id>`

---

## Headline metrics

| Metric | Q<N> <Year> |
|--------|-------------|
| Deals closed-won | <count> |
| Revenue sourced | $<formatted> |
| Referrals submitted | <count> |
| Commissions paid | $<formatted> |

## Pipeline & deals

- Top deal: <name> — $<value> (<status>, closed <YYYY-MM-DD>)
- <count> deals closed, average value $<avg>
- <stalled or notable deals to flag>

## Commissions

- Total paid: $<formatted>
- Largest single commission: $<value> (<deal name>, <YYYY-MM-DD>)
- Status: <all paid / N pending / N disputed>

## Referrals & deal registration

- <count> referrals submitted
- <count> converted (<rate>% conversion)
- <oldest stuck referral, if any, with date>

## Agreements

- <agreement name> — <status>, signed <YYYY-MM-DD>, expires <YYYY-MM-DD>
- <flag any expiring within 90 days of period end>

## Invoices (optional — include only if non-empty)

- <count> invoices issued in period, totaling $<sum>
- <flag overdue, if any>

## Suggested action items for Q<N+1> <Year>

> DRAFT — partner manager to confirm. Items below are inferences from the
> data above, not commitments.

- <bullet — e.g. "Renew master agreement (expires May 2026)">
- <bullet — e.g. "Follow up on 2 stuck referrals from late Q1">
- <bullet — e.g. "Approve 3 pending partner additions">
```

## Anti-hallucination rules

These rules are **not optional**. Every QBR must follow them.

1. **NEVER fabricate metrics.** If a tool returns empty or zero data for a
   section, write `"No <X> data for this period"` and omit the rest of that
   section. Do not invent numbers, "industry averages", or projections.

2. **NEVER compare quarters unless explicitly requested.** If the user asks
   for a Q-over-Q comparison, fetch both quarters' data separately and only
   then compute deltas. Otherwise, current-quarter-only.

3. **Currency formatting**: USD with thousand separators (e.g. `$1,234,567`).
   Dates always `YYYY-MM-DD`. Percentages with 1 decimal (e.g. `75.0%`).

4. **Action items are DRAFTS, not commitments.** Always mark the section with
   the `"DRAFT — partner manager to confirm"` caveat. Each item must be a
   direct inference from data actually fetched in this run, never generic
   advice.

5. **If any tool errors mid-run**, do NOT silently skip. Tell the user:
   - Which tool errored
   - What data is missing as a result
   - Offer to retry or to continue with a partial QBR (with a banner at the
     top noting which sections are incomplete)

6. **Do not summarize across multiple partners.** This skill is per-partner.
   If the user asks "QBR for all my partners", explain the scope and offer to
   run the skill once per partner.

## Example user flow

```
User: "Generate a QBR for Beta Solutions for Q1 2026"

Claude:
1. Reads this skill (generate-qbr playbook)
2. list_accounts → finds Beta Solutions, partner_id = 1721...
3. performance(partner, 2026-01-01, 2026-03-31) → revenue + deal count
4. partner_artifacts(action: "deals", partner_id) → pipeline detail
5. commissions(partner, 2026-01-01, 2026-03-31) → commission detail
6. partner_artifacts(action: "referrals", partner_id) → referrals
7. partner_artifacts(action: "agreements", partner_id) → agreements
8. Renders markdown QBR doc

User: copies output → pastes into Slack / Google Doc / email to the partner.
```

## Why this skill exists

A QBR currently takes a partner manager 1–2 hours per partner per quarter —
opening 5 different tools, copying numbers into a deck, formatting tables by
hand. With this skill the same output is one prompt + a few seconds of tool
orchestration. At scale (a customer with 14 partners × 4 quarters = 56 QBRs
per year), the time saved is in the dozens of hours.
