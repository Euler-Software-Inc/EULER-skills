# Plan — account-aware skills (customer vs partner)

> Status: planning. Scope decision (2026-06-01): **plugin-side only — no euler-mcp
> changes.** Gating + friendly messaging are handled entirely inside the skills.

## 1. Domain model (from euler-mcp)

- **Customer** = the EULER tenant / PRM owner (e.g. Martus).
- **Partner** = a partner *of* a customer (the customer's "client"). One user can be
  a partner of multiple customers; each `(partner, customer)` pair is one account.
- The OAuth token carries `roles[]` (`customer` and/or `partner`), sealed at consent.
  Identity is never taken from args.

### How the MCP enforces scope (server-side — the real security boundary)
- Each tool has `scope: customer | partner | both` (`src/catalog/tools.ts`).
- `guard-rails.ts › authorizeToolCall`:
  - no roles → `no_roles`
  - `customer`/`partner` tool → token must carry that role, else `forbidden_scope`
  - `both` → any role; if both, **partner wins** (refined back to customer per-call by
    `partner_id` ownership for an allowlist).
- **`list_accounts` is the discovery anchor**: returns every account context
  (`type: customer|partner`, `dashboard_url` per type, `consent_summary`,
  `backend_data_issue`). This is where a skill learns what the connected account can do.

### Current catalog reality
- Almost everything is **customer-scoped**. A **partner**-role token can only call the
  `both` tools (`partner_artifacts`, `referrals`, `submit_referral`, `get_search_deals`,
  `content_search`) + the `partner` actions of `performance`/`commissions`, all
  self-scoped. **No partner-only tools.**
- Customer-only (partner cannot reach): `partners`, `partner_directory_search`,
  `list_partner_contacts`, `invite_partner_to_portal`, `company_invoices`,
  `charges_lookup`, all `flow_*`, `incentives_summary`.

### The gap (skill-side fix only)
`forbidden_scope` returns structured data (`required_scope`, `token_roles`) but **no
human-readable `message`**. We will NOT change the MCP. Skills must (a) pre-empt the
mismatch via `list_accounts`, and (b) translate a `forbidden_scope` that still escapes
into a friendly message — defense-in-depth.

> ⚠️ Skills are NOT a security boundary. The MCP guard-rail stays authoritative. The
> skill gate is **UX only** (avoid a raw error; route the user somewhere useful).

## 2. The account-gate convention (reusable, applied to every skill)

Lives as a self-contained `references/account-gate.md` in each skill (skills must be
self-contained for standalone zip upload — see the partner-briefing fix). SKILL.md
references it one level deep and stays lean (<500 lines, per best practices).

**Every skill's Step 1 = `list_accounts`.** Then branch:

| Connected account has… | Skill requires… | Action |
|---|---|---|
| required type present | customer / partner / either | proceed in that `role_context` |
| only the other type | a specific type | **friendly message + stop** (don't hit `forbidden_scope`) |
| both types | a specific type | proceed in the required one |
| both types | either | ask which context, or use the skill's default |

**Friendly message template (mismatch):**
> "This `<skill>` is for `<required audience>`. Your EULER connection is a
> `<actual type>` account. As a `<actual type>`, try `<suggested skill>` instead — or
> open your dashboard: `<dashboard_url from list_accounts>`."

**`forbidden_scope` translation (defense-in-depth, if it escapes mid-run):** map
`required_scope` + `token_roles` from the error into the same friendly message. Never
surface the raw code or `forbidden_scope` to the user.

Also handle `backend_data_issue` on `list_accounts` (surface `support_email`, do NOT
suggest reconnect) — already documented in generate-qbr.

## 3. Per-skill audience declaration (best-practice: description drives selection)

Each SKILL.md frontmatter `description` states **what + when + audience + trigger terms**
(third person). Add a one-line **Account type** prerequisite at the top of the body.
Keep terminology consistent ("customer admin / partner manager" vs "partner").

## 4. Skill families

| Family | Audience | Role context | Skills | Tools (scope) |
|---|---|---|---|---|
| **Customer-admin** (existing pattern) | partner manager reviewing THEIR partners | customer (+ both) | generate-qbr, partner-briefing, portfolio-pulse, onboarding-progress, partner-portal-invite, billing-report, incentive-standing | customer + both |
| **Partner-facing** (new) | a partner viewing THEIR OWN data with one customer | partner (both only) | my-performance (self-view mirror of QBR), my-referrals / submit-a-referral ✍️, my-deals | `both` self-scoped |

Partner-facing skills must pick which customer (a partner may have several) via
`list_accounts` → `affiliate_company_name`.

## 5. Known limitation (no MCP change planned — open question)

Partner-role users **cannot** see their own onboarding/flows, incentives, invoices, or
directory via MCP today (all customer-scoped). Partner-facing skills are therefore
limited to the `both` surface. If partner self-service onboarding becomes a priority,
that's a future euler-mcp request (e.g. a partner-scope `flow_assignment(action:'mine')`)
— **not in this plan.** Documented so skills don't promise data they can't fetch.

## 6. Sequence (grounded in skill best practices)

Best practices favor: *start small, get one focused pattern right before multiplying;
make error handling explicit and degrade gracefully; use progressive disclosure.*

1. **Account-gate convention first** — define `references/account-gate.md` + the decision
   tree + message templates, and retrofit the 2 existing skills (generate-qbr,
   partner-briefing). This is foundational infra every new skill inherits, and it IS the
   graceful-degradation discipline the docs emphasize.
2. **Partner-facing `my-performance`** — first skill of the new family, proving the gate
   in partner `role_context`. Self-view mirror of the QBR backbone.
3. **Complete customer-admin** — portfolio-pulse, onboarding-progress, etc., reusing the
   backbone + the gate.

## 7. Per-skill quality checklist (best practices)

- [ ] `description`: what + when + audience + concrete trigger terms (third person)
- [ ] "Account type" prerequisite line in the body
- [ ] Step 1 is `list_accounts`; gate decision tree applied
- [ ] Friendly mismatch message + `forbidden_scope` translation (no raw codes)
- [ ] SKILL.md body < 500 lines; detail in `references/` one level deep; self-contained
- [ ] Consistent terminology; concrete (not abstract) examples
- [ ] ≥3 evaluations; tested with Haiku/Sonnet/Opus; validated against live MCP
