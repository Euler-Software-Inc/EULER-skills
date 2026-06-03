# my-performance — MCP field paths & quirks (self-scoped)

`partner_id` resolves from `list_accounts` (entry with `type:'partner'`, match `affiliate_company_name`).
All numerics arrive as STRINGS — `Number()` before any math. Treat `""`/`"$"`/`"$0"` as 0.

## performance(action:'partner', partner_id, start_date, end_date)  — window
- deal count, booking/billings revenue, win rate, sales cycle, ACV.
- Zero-denominator: when 0 deals closed in the window, OMIT win rate / sales cycle / ACV.

## partner_artifacts(action:'deals', partner_id)  — lifetime
- open pipeline: `Deal name`, stage, `Amount`. `last_stage_change_date` is a DURATION string;
  values ≥ 9999 days are the null/garbage sentinel — never render as aging.

## commissions(action:'partner', partner_id, start_date, end_date)  — window
- commissions paid/earned + breakdown.

## referrals(action:'for_partner', partner_id)  — lifetime
- count + `Submitted On` (real date). JSON serialization quirk (commas vs colons in
  `result_per_page`) — parse loosely.

## partner_artifacts(action:'agreements', partner_id)  — lifetime
- `Status` + `Signed On`. Foundational = MNDA / master / partner / agency agreement.

## Health
Compute per `docs/partner-health-model.md` (full mode) from the above — the 5 factors
(Production/Pipeline/Engagement/Foundation/Recency, weights 35/20/20/15/10), score 0-100, band, caps.
Dates render `YYYY-MM-DD`.
