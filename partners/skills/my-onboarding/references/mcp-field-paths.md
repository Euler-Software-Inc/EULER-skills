# my-onboarding — MCP field paths & response quirks

Source: euler-mcp catalog (`src/catalog/tools.ts`) + `docs/api-mapping/tools-by-function.md`.
Both `partner_flow_*` tools are `scope: partner` (a customer-admin session does not see them).

## partner_flow_details(partner_id)  — scope: partner, read
- No drill-down param → list of flows currently assigned to the partner (the discovery call; start here).
- `name` → filter that assigned-flow list by title.  `flow_id` → flow details + step IDs.  `flow_step_id` → step details.
- The three drill-down params (`name`, `flow_id`, `flow_step_id`) are **mutually exclusive — pass at most one per call** (the workflow returns only the first matching intent and drops the rest). Drill down with separate sequential calls.
- `partner_id` REQUIRED — resolve from `list_accounts` (entry with `type:'partner'`, match `affiliate_company_name`). Non-assigned flows return empty data, not an error.

## partner_flow_progress(partner_id, flow_id)  — scope: partner, read
REQUIRED: `partner_id`, `flow_id` (resolve `flow_id` from `partner_flow_details` first). Returns
(numbers arrive as STRINGS — `Number()` before any math/sort):
- `total_steps`, `done_count`, `failed_count`, `to_do_count`, `overdue_count`
- `percent_complete`
- `done_details` / `failed_details` / `to_do_details` / `overdue_details`
    → JSON-string concats of `{title, description, type}` per step. Parse defensively (loose JSON,
      same posture as `referrals`). On parse failure, show the count only — never fabricate a step list.
- `flow_title`, `flow_description`, `flow_type`, `flow_due_date`, `flow_due_in_days`, `flow_id`, `assignment_id`, `progress`
- `certification_badge` → a URL when earned; sentinels `"Not earned yet."` / `"No image attached."` otherwise
    → never render a sentinel as an image/URL. Show "badge earned" only on a real URL.
- A `flow_id` outside the partner's assignments returns empty counts + empty detail lists (NOT an error).

## Overall % across flows
`Σ done_count / Σ total_steps` across all flows — NOT the average of per-flow `percent_complete`
(a 2-step and a 20-step flow must not weigh equally). Zero-denominator (Σ total_steps = 0) → render "—".

## Dates
`flow_due_date` and any date render as `YYYY-MM-DD`. `flow_due_in_days` is the signed days-to-due
(negative = overdue). "Overdue" comes only from `overdue_count` / `flow_due_in_days` — never inferred.
