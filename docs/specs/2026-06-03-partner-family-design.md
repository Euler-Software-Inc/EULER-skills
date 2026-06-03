# Partner self-service family — design spec (4 skills)

> Date: 2026-06-03 · Status: approved design, pre-implementation.
> Completes the partner-facing family in the **`euler`** plugin (after `my-onboarding` + `my-performance`).
> Four skills, shipped together in **one PR** + one version bump (0.15.0 → 0.16.0).
> Companion: [`PLAN-account-aware-skills.md`](../../PLAN-account-aware-skills.md).

## Shared conventions (all four)

- **Partner-required gate** (same as `my-onboarding`/`my-performance`): step 1 = `list_accounts`;
  needs a `type === 'partner'` entry; customer-only → friendly redirect + STOP; multiple partner
  accounts → pick by `affiliate_company_name`; `partner_id` from the partner entry only, never
  `partner_directory_search`. Each skill ships its own `references/account-gate.md` (partner variant).
- **Self-scoped** — only the caller's own data.
- **Multilingual** — render in the user's requested language (SKILL.md + CSS stay English).
- **Modern Euler template** — text wordmark, own copy of the canonical `styles.css`, lightweight + mobile-first.
- **Reads → full HTML report; writes → a compact confirmation card** (a write's value is the action, not a report).
- Numerics arrive as strings → `Number()`; currency normalization; no internal IDs in output; flag test-data but keep in counts.

---

## 1. my-referrals (READ — light)

**Purpose:** a partner sees their own submitted referrals / deal-registrations and where each stands.
**Tool:** `referrals(action:'for_partner', partner_id)` — referrals submitted by the caller (paginated).
**Output:** a worklist (`.table-wrap`) — Company · Type (Referral / Deal registration) · Status (pending/approved/rejected) · Submitted (date), sorted most-recent first; hero quick-facts (Total · Pending · Approved · most-recent). A CTA/note to submit a new one (`/euler:submit-a-referral`). Segment/sort by status; silence empty states with a positive "no referrals yet" message.
**Anti-hallucination:** status/date only from real fields; loose JSON parse (`referrals` has the comma/colon serialization quirk); flag obvious test entries.

## 2. my-deals (READ — light)

**Purpose:** a partner's own deal pipeline — deeper on deals than `my-performance`'s top-5.
**Tools:** `partner_artifacts(action:'deals', partner_id)` (the list); `get_search_deals(deal_name, partner_id)` only when the user names a specific deal to look up.
**Output:** pipeline view — open deals grouped by stage (Stage · Deal · Amount) in a `.table-wrap`, hero quick-facts (Open count · Open value · Closed-won · Avg size); a `.dist` of stage counts. **Aging only from `last_stage_change_date` durations < 9999 days** (≥9999 = null/garbage sentinel — never render). Closed-lost omitted if $0.
**Anti-hallucination:** the 9999-day sentinel rule; no fabricated aging; test-data flag.

## 3. submit-a-referral (WRITE ✍️ — the careful one)

**Purpose:** a partner submits a new referral / deal registration through chat.
**Flow (exact — do not deviate):**
1. `list_accounts` → gate + `partner_id`.
2. `referrals(action:'get_form_for_partner', partner_id)` → `form_id` + `questions[]` (each with `answer_field` = `answer_text` | `multiselect_options`) + `presentation_guidance`.
3. Present the questions to the user **following `presentation_guidance`** (especially for long forms); collect every **required** answer.
4. **Confirm the collected answers with the user** before sending.
5. `submit_referral(partner_id, form_id, answers)` — `answers` = JSON array of `{question_id, answer_text, multiselect_options[]}`; place each value in the field its question's `answer_field` indicates (almost always `answer_text`; only true multi-select uses `multiselect_options`).

**Write discipline (W1–W6 — not optional):**
- **ONE `submit_referral` call per logical request. NEVER poll or retry it** (the 2026-05-07 incident created 30 orphan referral rows from a retry loop). If a deploy/state needs waiting, poll a READ — never the write.
- The MCP runs a server-side preflight that validates answers against the form and reifies the shape — trust it; don't re-implement.
- `form_id` is checked against the partner's current form; a stale one returns `form_id_mismatch` → re-fetch the form (step 2) and retry once with the fresh `form_id` (re-fetch, not blind retry).
- Customer-admins cannot submit (partner-side action) — the gate already blocks them.

**Output:** a **compact confirmation card** — what was submitted (referred company + type + the key answers) + the returned status. No big report. On error (`form_id_mismatch`, validation), surface the friendly reason + what to fix; never claim success on an error.

## 4. my-tracking-links (WRITE — idempotent)

**Purpose:** a partner creates/lists their affiliate tracking links.
**Tools:**
- `partner_artifacts(action:'tracking_links', partner_id)` — list the partner's existing links.
- `create_tracking_link(partner_id, url, label, [extras])` — create one. `extras` = array of `key<>value` strings (literal `<>`). Idempotent by `(partner_id, label)`.
**Returns** `{link, status, AI_instruction}`: `status='Created'` (`link` is the new URL); `'Duplicated'` (a link with that label exists — `link` empty, `AI_instruction` carries the existing URL + message → surface it); `'Error'` (partner_id didn't resolve — surface `AI_instruction`).
**Write discipline:** idempotent (safe), but still ONE create call per request, no polling. Require an explicit `label` + `url` from the user before creating; confirm.
**Output:** a compact card — the created/existing link + label + status; optionally a small list of existing links (from `tracking_links`). Handle all three statuses honestly.

---

## Files (each skill, in the euler plugin)

```
skills/my-referrals/        SKILL.md · references/{account-gate,mcp-field-paths}.md · assets/{styles.css,template.html} · examples/<x>.md
skills/my-deals/            (same shape)
skills/submit-a-referral/   (same shape; template = compact confirmation card)
skills/my-tracking-links/   (same shape; template = compact link card)
```
Plus once, at the end: `plugin.json` + `marketplace.json` keywords + **version 0.15.0 → 0.16.0**; README (4 new rows).

## Decomposition / packaging

All four in the `euler` plugin. Built on `dev`; **one PR for all four** at the end (+ the single version bump). After these, the partner self-service family is complete.

## Evals (per skill)

- **my-referrals:** partner with mixed-status referrals → worklist sorted by recency, counts in hero, empty state positive; PT request → PT output.
- **my-deals:** partner with open pipeline → stages + amounts, aging only from valid durations, closed-lost omitted if $0.
- **submit-a-referral:** form fetched → questions presented per guidance → answers confirmed → ONE submit → confirmation card; `form_id_mismatch` → re-fetch + retry once; never a retry loop; customer-only → gate.
- **my-tracking-links:** create with a new label → Created card; same label again → Duplicated (surface existing URL); list existing; no-polling.
- **All:** partner gate (customer-only → redirect), multilingual, no dead classes, `claude plugin validate --strict` passes.
