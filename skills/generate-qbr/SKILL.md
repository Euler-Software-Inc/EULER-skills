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
- Resolution order:
  1. Call `list_accounts` — if the user has an account with that partner
     (rare; user is usually customer-side), match `affiliate_company_name`
     (case-insensitive).
  2. Otherwise call `partners(action: 'list', filter_name: '<name>')` — this
     is the customer-admin path. Match against `"Partner name"` in the
     response (case-insensitive substring).
- If multiple matches, list them with their `status` field and ask the
  user to pick.
- If no match, tell the user the partner isn't visible in their account
  and offer to list all partners (`partners(action: 'list')` without
  filter, page through if needed).

### 2. Which quarter?

- Accept any of: `"Q1 2026"`, `"Q4 2025"`, explicit ISO dates, `"last quarter"`,
  `"this quarter"`.
- Convert to `start_date` / `end_date` in **`YYYY-MM-DD`** format:
  - Q1 = Jan 1 – Mar 31
  - Q2 = Apr 1 – Jun 30
  - Q3 = Jul 1 – Sep 30
  - Q4 = Oct 1 – Dec 31
- If `"last quarter"` or ambiguous, infer from today's date and **CONFIRM with
  the user before proceeding**. Never silently guess.

> ⚠️ **Date format gotcha:** the `performance` tool's schema description says
> "ISO 8601 UTC datetime (e.g. '2024-04-07T00:00:00.000Z')". Empirically
> (validated 2026-05-25) that format is broken — the backend returns
> corrupted years like "Nov 28, 4763". Use `YYYY-MM-DD` for ALL date
> params across all tools. If a future MCP release fixes the parser,
> revisit.

## Orchestration sequence

Run these EULER MCP tools in order. Default to running them all for a
standard QBR. Skip a step only if the user's framing explicitly excludes it
(e.g. "QBR without commissions").

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `list_accounts` | Customer-side `name` for the QBR header (the customer hosting the partnership). |
| 2 | `partners(action: 'list', filter_name: '<name>')` | Resolves `partner_id` from a name. Skip if user provided `partner_id` directly. |
| 3 | `performance(action: 'partner', partner_id, start_date, end_date)` | **Period-filtered** headline metrics: deal count, booking/billings revenue, win rate, sales cycle, ACV. |
| 4 | `partner_artifacts(action: 'deals', partner_id, page: 1, limit: 20)` | **All-time** deals pipeline (NOT period-filtered — see disclaimer rule below). |
| 5 | `commissions(action: 'partner', partner_id, start_date, end_date)` | Period-filtered commissions paid + breakdown. |
| 6 | `referrals(action: 'for_partner', partner_id, page: 1, limit: 20)` | **All-time** referrals submitted by the partner (NOT period-filtered). |
| 7 | `partner_artifacts(action: 'agreements', partner_id)` | Agreement list with `Status` + `Signed On`. No `expires_on` field available. |
| 8 | `partner_artifacts(action: 'invoices', partner_id, page: 1, limit: 20)` | All-time invoices. Include only if non-empty. |

### Tool-by-tool response field paths

The MCP backend (Bubble-based) returns inconsistent field names. Use these
**exact** paths — verified against staging on 2026-05-25. Do NOT invent
field names. If a path you'd want is missing here, the field doesn't exist.

#### `list_accounts`
```
accounts[].id, .type, .name, .company_id, .partner_id, .affiliate_company_name (partner only), .dashboard_url
consent_summary.hidden_count
```

#### `partners(action: 'list')`
Returns a stringified-JSON-array under `response.result` (loose parsing
required — see Rule 7). Each entry:
```
partner_id, "Partner name", status
```
(`status` may be empty string for unconfigured partners.)

#### `performance(action: 'partner')`
```
partner_id, start_date (echoed), end_date (echoed),
total_deals_count (string, may be "0"),
booking_revenue (string with "$" prefix; may be just "$" when zero — see Rule 3),
billings_revenue (string like "$100.00"),
win_rate (string like "0.00%"),
sales_cycle (string like "0 Days"),
avg_contract_value (string like "$0"),
partner_status
```

#### `partner_artifacts(action: 'deals')`
```
total_items (string), page, limit, partner_id,
Result[].deal_id
Result[].Amount (string, raw number, NO currency prefix — e.g. "500")
Result[]."crm status (deal_stage)" (yes, with spaces and parens — use this exact key)
Result[]."Deal name"
Result[].last_stage_change_date (string like "20599 Days" — this is a DURATION, not a date. Do NOT format as a date.)
```

#### `commissions(action: 'partner')`
When empty, returns the literal string `"Empty (this search did not return any results)"`.
When populated, shape varies — read it and adapt; do not assume structure.

#### `referrals(action: 'for_partner')`
Returns `result_per_page` as a stringified JSON-like blob with a
**serialization bug**: pairs use commas instead of colons
(`{"id","value"}` instead of `{"id":"value"}`). Parse loosely.
Fields per entry:
```
id, "Referred company name", Status, "Submitted On"
```

#### `partner_artifacts(action: 'agreements')`
Returns `Result[]` with **corrupted keys** (`ïd` with diaeresis). Skip the id field.
Usable fields per entry:
```
"agreement Name" (note lowercase 'agreement')
Status
"Signed On" (may be empty string when unsigned)
```
There is **no `expires_on` / renewal-date field**. Do not write "expires
YYYY-MM-DD" in the output — the data doesn't exist.

#### `partner_artifacts(action: 'invoices')`
When empty: `Result: [Empty (this search did not return any results)]`.
When populated, treat field names as case-sensitive and document on first
encounter.

### Error handling during orchestration

- **`partner_not_in_consent`** → abort. Tell the user to disconnect + reconnect
  and include this partner in their consent selection. Do not generate a partial
  QBR.
- **`backend_data_issue`** on `list_accounts` → continue with `partners(list)`
  for partner_id resolution; surface the `support_email` in a banner at the
  top of the output.
- **`euler_session_expired` / `euler_user_token_missing`** → instruct the user
  to follow Claude's inline reconnect prompt, then retry.
- **Any single tool returning empty data mid-sequence** → continue. The output
  format handles missing sections gracefully (see Rule 1).
- **A tool errors mid-run** → continue with the remaining tools, then surface
  a banner at the top of the output listing which sections are incomplete and
  why.

## Output format

Render a single markdown document. Use this exact structure. Bracketed
`<...>` placeholders are computed from the response field paths above.

```markdown
# Q<N> <Year> — <Partner name> × <Customer name>

**Period:** <start_date> to <end_date>
**Partner status:** <performance.partner_status>
<!-- Once the MCP exposes the partner's CRM ID (HubSpot/Salesforce/etc),
     render it here as: **Partner CRM ID:** `<crm_id>`.
     Until then, DO NOT print the internal EULER partner_id — it's an
     opaque Bubble identifier with no meaning to the partner manager. -->

> ⚠️ Disclaimer: Headline metrics below are filtered to the period above.
> Pipeline, referrals, agreements, and invoices sections show **all-time
> data** — the underlying tools do not accept a date range. Use stage
> + Submitted On dates as approximate filters when interpreting.

---

## Headline metrics (period-filtered)

| Metric | Q<N> <Year> | Source field |
|--------|-------------|--------------|
| Deals closed (period) | <performance.total_deals_count> | `performance.total_deals_count` |
| Booking revenue | <booking, see Rule 3> | `performance.booking_revenue` |
| Billings revenue | <performance.billings_revenue> | `performance.billings_revenue` |
| Win rate | <performance.win_rate> | `performance.win_rate` |
| Average sales cycle | <performance.sales_cycle> | `performance.sales_cycle` |
| Average contract value | <performance.avg_contract_value> | `performance.avg_contract_value` |
| Commissions paid (period) | $<sum from commissions> | `commissions` (computed) |

## Pipeline & deals (all-time)

- Total deals on record: <deals.total_items>
- Breakdown by stage:
  - Closed Won: <count> — $<sum of Amount> total
  - Closed Lost: <count> — $<sum of Amount> total
  - In progress (everything else): <count> — $<sum of Amount> total
- Top open deal by Amount: <Deal name> — $<Amount> (<crm status (deal_stage)>)
- Top closed-won deal: <Deal name> — $<Amount>

> If `performance.booking_revenue` is empty/"$" but Closed Won deals exist
> here, note in narrative: "Period booking revenue reported as $0 by
> performance tool — Closed Won deals on file may pre-date the period
> (no closed-on date available in the deals tool)."

## Commissions (period-filtered)

- Total paid: $<sum>
- Largest single commission: $<value> (<deal name if available>)
- Status breakdown: <e.g. all paid / N pending>

If empty: `> No commissions data for this period.`

## Referrals & deal registration (all-time)

- <total_count> referrals on record
- By status: <count> pending · <count> approved · <count> rejected · <count> other
- Most recent submission: <Submitted On> — <Referred company name> (<Status>)
- Submissions within the period (<start_date>–<end_date>): <count, computed by
  parsing "Submitted On">

If empty: `> No referrals on record for this partner.`

## Agreements

- <total_items> agreements on record:
  - <agreement Name> — <Status> (signed: <Signed On or "unsigned">)
  - ...

If empty: `> No agreements on record for this partner.`

## Invoices

(Include section only if non-empty.)
- <total_items> invoices issued, totaling $<sum>
- <flag any overdue>

## Suggested action items for Q<N+1> <Year>

> DRAFT — partner manager to confirm. Items below are inferences from the
> data above, not commitments. Each item links to the metric that prompted it.

- <bullet, e.g. "Push 2 Pending agreements (MNDA, Tech Partner Agreement) to signature" → linked to Agreements section>
- <bullet, e.g. "Triage 5 pending referrals from Nov 2025 — oldest is 200 days stale" → linked to Referrals section>
- <bullet, e.g. "Investigate why performance.booking_revenue reports $0 while deals tool shows N Closed Won — possible pre-period deals" → linked to Headline + Pipeline>
```

## Anti-hallucination rules

These rules are **not optional**. Every QBR must follow them.

0. **NEVER render internal EULER IDs in the output.** The `partner_id`
   (e.g. `1715179138375x527400652689293400`) is a Bubble-internal opaque
   string and means nothing to a partner manager. It is used for
   orchestration only — never printed in the rendered QBR. When the MCP
   adds the partner's CRM ID (HubSpot/Salesforce/etc), render that
   instead. Same rule applies to `deal_id`, agreement id, referral id —
   internal IDs stay internal.

1. **NEVER fabricate metrics.** If a tool returns empty or zero data for a
   section, write `"No <X> data for this period"` or `"No <X> on record"`
   and omit the rest of that section. Do not invent numbers, "industry
   averages", or projections.

2. **NEVER compare quarters unless explicitly requested.** If the user asks
   for a Q-over-Q comparison, fetch both quarters' data separately and only
   then compute deltas. Otherwise, current-quarter-only.

3. **Currency normalization.** The `performance` tool returns currency as
   strings, sometimes malformed (e.g. `"$"` with no number when zero).
   Treat `""`, `"$"`, `"$0"`, `"$0.00"` all as zero. Display as
   `$0` in the table. For non-zero values keep thousand separators
   (e.g. `$1,234,567`). Percentages as returned (e.g. `"75.0%"`).

4. **Dates from responses are echoed strings, not always dates.** Examples
   that are NOT dates: `"20599 Days"` (a duration), `"0 Days"` (zero
   duration). Examples that ARE date strings: `"Jan 1, 2026 5:46 pm"`,
   `"May 9, 2024"`. When in doubt, render the string verbatim — never
   reformat unless you've parsed it successfully.

5. **Action items are DRAFTS, not commitments.** Always mark the section
   with the `"DRAFT — partner manager to confirm"` caveat. Each item must
   be a direct inference from data actually fetched in this run, never
   generic advice. Each item should reference which section / metric it
   came from.

6. **If any tool errors mid-run**, do NOT silently skip. Add a banner at
   the top of the output:
   > ⚠️ Partial QBR: the following sections are incomplete due to errors:
   > [list].

7. **Loose JSON parsing required.** The MCP backend (Bubble) returns
   stringified JSON-like content under `response.result` and
   `result_per_page`. Some shapes have known bugs:
   - `referrals(for_partner).result_per_page`: pairs use commas instead of
     colons (`{"id","value"}` not `{"id":"value"}`).
   - `partner_artifacts(agreements).Result[]`: keys have unicode noise
     (`ïd` with diaeresis).
   - Numbers come as strings throughout. Parse with `Number()` /
     `parseFloat` / regex before computing.

   If you can't parse a response into the expected fields, surface that as
   an error rather than guessing.

8. **All-time vs period-filtered must be labeled.** `performance` and
   `commissions` are period-filtered (accept start_date/end_date).
   `partner_artifacts` and `referrals(for_partner)` return all-time data.
   The output template enforces this distinction with section subtitles.
   Never silently mix them.

9. **Do not summarize across multiple partners.** This skill is per-partner.
   If the user asks "QBR for all my partners", explain the scope and offer
   to run the skill once per partner.

## Example user flow

```
User: "Generate a QBR for Axion DataWorks for Q1 2026"

Claude:
1. Reads this skill (generate-qbr playbook)
2. list_accounts → customer self = "Martus" (for header)
3. partners(action: 'list', filter_name: 'Axion DataWorks') →
   partner_id = 1715179138375x527400652689293400
4. performance(action: 'partner', partner_id, '2026-01-01', '2026-03-31') →
   0 deals, $0 booking, $0 billings (period-empty)
5. partner_artifacts(action: 'deals', partner_id) →
   4 all-time deals: Target $500 Won, Best Buy $775 Demo, Honda $3000 Lost, GM $1000 Won
6. commissions(action: 'partner', ...) → empty
7. referrals(action: 'for_partner', partner_id) →
   2 all-time, both May 2024
8. partner_artifacts(action: 'agreements', partner_id) →
   2 pending (MNDA, Tech Partner Agreement)
9. partner_artifacts(action: 'invoices', partner_id) → empty
10. Renders markdown QBR per the template above.

User: copies output → pastes into Slack / Google Doc / email to the partner.
```

## Known limitations (v0.2.0)

Things the skill cannot do today, by tool constraint. Logged for upstream
MCP improvements:

- **No partner CRM ID exposed.** Customer-side tools return the
  EULER-internal `partner_id` only. Partner managers want the CRM ID
  (HubSpot / Salesforce / Pipedrive object id) in their QBR. Pending
  upstream MCP change — once added to `partners(list)`, `list_accounts`,
  and `performance(partner)` responses, surface it in the header.
  Assigned: Marcelo (Bubble-side).
- **No period filter for deals / referrals / agreements / invoices.** Listed
  as all-time. Workaround: parse `"Submitted On"` for referrals and
  approximate.
- **No `closed_on` date in deals.** `last_stage_change_date` is a duration,
  not a timestamp.
- **No `expires_on` for agreements.** Cannot surface renewal risk.
- **No Sourced/Influenced/Delivered split** in `performance`. The MCP tool
  `influenced_sourced_deals` exists and could be added in a future version.
- **No MDF / incentives data.** `incentives_summary` exists; future
  enhancement.
- **Q-over-Q comparison** not built-in. Roadmap v0.3.

## Why this skill exists

A QBR currently takes a partner manager 1–2 hours per partner per quarter —
opening 5 different tools, copying numbers into a deck, formatting tables by
hand. With this skill the same output is one prompt + a few seconds of tool
orchestration. At scale (a customer with 14 partners × 4 quarters = 56 QBRs
per year), the time saved is in the dozens of hours.
