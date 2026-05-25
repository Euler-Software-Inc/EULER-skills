# generate-qbr — Implementation plan

> **For the next AI agent picking up this skill.** This plan is self-contained.
> Read it, execute the tasks in order, then delete this file when the skill is
> production-ready.

## Status today

- `SKILL.md` is **drafted but unvalidated** against the live EULER MCP catalog.
- All tool references, params, action names, and response-field paths were
  written from memory of the MCP design — they have NOT been cross-checked
  against `euler-mcp/src/catalog/tools.ts`.
- The skill has never been invoked end-to-end. No real output exists.

## Goal

Take the QBR skill from "draft" to "production-ready":

1. Every tool call, param, action name in `SKILL.md` matches the live MCP catalog **exactly**
2. Every response-field reference in the output template matches the actual MCP response shape
3. The skill runs cleanly against staging with real data for 2+ partners + 1 empty-data scenario
4. Output renders consistently across runs (no LLM drift on identical inputs)

The QBR is the flagship skill of this plugin — it's the use case we lead with
for the marketplace submission and external announcements. It has to feel
solid.

## Why this exists (one paragraph for context)

A QBR (Quarterly Business Review) is a recurring document a partner manager
produces every 3 months for each partner. Currently it takes 1–2 hours per
partner per quarter by hand: opening 5 different EULER screens, copying
numbers into a slide deck, formatting tables. This skill compresses that to
one prompt + a few seconds of MCP tool orchestration. At a customer with 14
partners × 4 quarters/year = 56 QBRs/year saved, the time savings is in the
dozens of hours per partner manager per year.

## Repos you'll work with

```
~/EULER/
├── EULER-skills/          # THIS repo (your working tree)
│   └── skills/generate-qbr/
│       ├── SKILL.md       # what you'll iterate on
│       └── PLAN.md        # this file
└── euler-mcp/             # MCP server (READ-ONLY reference)
    └── src/catalog/tools.ts   # source of truth for tool signatures
```

Clone the MCP repo alongside this one if it's not already there:

```bash
cd ~/EULER
git clone https://github.com/Euler-Software-Inc/euler-mcp.git
cd euler-mcp && git checkout dev && git pull
```

The `dev` branch has the most recent catalog state.

---

## Tasks (execute in order)

### Task 1 — Verify every tool reference against the live catalog

Open `~/EULER/euler-mcp/src/catalog/tools.ts` and `src/catalog/categories.ts`.
For each entry in the orchestration table in `SKILL.md` (lines ~70–85),
verify:

- [ ] **Tool name** exists in `tools.ts` (e.g. `list_accounts`, `partner_artifacts`)
- [ ] **Action name** for multi-action tools matches a key under `routes` (e.g. `action: 'deals'` is a valid action of `partner_artifacts`)
- [ ] **Required params** in `inputSchema.required` — `SKILL.md` must pass all of them
- [ ] **Param types** — match `inputSchema.properties.<name>.type`
- [ ] **Scope** — the tool's `scope` allows partner-side calls (not `customer-only`)

Common issues to watch for:

- A required param was added to a tool after `SKILL.md` was drafted → the skill must pass it
- An action was renamed → the skill's `action:` string is stale
- A tool was retired (`enabled: false` or removed entirely) → swap in the
  successor. Check `git log -- src/catalog/tools.ts` in the MCP repo for
  recent retirements. As of 2026-05-20: `tool_get_company_deals` was retired
  in favor of `get_search_deals`.
- Enums tightened: e.g. `status` was `string`, now strict enum

If a tool you'd want is missing entirely, do NOT invent it. Open an issue
on the `euler-mcp` repo and either (a) deprioritize that section of the
QBR or (b) wait for the tool to land before iterating further.

### Task 2 — Verify response shape references against the MCP docs

The output template in `SKILL.md` references fields like:

- "Top deal: `<name>` — `$<value>` (`<status>`, closed `<YYYY-MM-DD>`)"
- "Top contributor: `$<value>` (`<deal name>`, `<YYYY-MM-DD>`)"

Each of those `<name>`, `<value>`, `<status>` etc. corresponds to a field
in the tool's response. Verify the field paths exist in the actual response
shapes.

Sources of truth, in priority order:

1. `~/EULER/euler-mcp/docs/api-mapping/api-docs.md` — canonical doc kept in
   sync by Marcelo (the Bubble-side dev). Look for sections titled with each
   tool name; each has an "Expected Output" block.
2. The actual response from staging (see Task 3) — empirical wins
3. The Bubble Data Type definitions if you have access — but `api-docs.md`
   should be enough

For each field referenced in `SKILL.md`'s template, write down the actual
field path. If a field doesn't exist or has a different name, update the
template.

If a referenced field is genuinely missing from the response, two options:

(a) Pick a different field that conveys similar info ("If `deal.value` isn't
    in the response, fall back to `deal.amount` or `deal.commission_value`")
(b) Drop that line from the template

### Task 3 — Run the skill end-to-end against staging

Staging MCP URL: `https://euler-mcp-staging.dave-d45.workers.dev/mcp`

You'll need a test EULER account with:
- At least 1 partner with deals + commissions + referrals + agreements in a
  recent quarter (for the happy path)
- At least 1 partner with NO data in some sections (to test the
  empty-section path)

Ask the human user which test account credentials to use — do not guess or
invent. The user should hand you a sandbox login or point you to QA fixtures.

Once connected (OAuth flow), invoke the skill:

```
> Generate a QBR for [test partner name] for Q1 2026
```

Capture the **actual** output verbatim. Save it as
`skills/generate-qbr/examples/<run>-raw.md` for the duration of this work
(it gets deleted before merge unless you decide to keep a sanitized version
— see Task 5).

Compare against the template in `SKILL.md`. Note discrepancies in a scratch
file:

- [ ] Fields where the LLM clearly fabricated a value (no source in the response)
- [ ] Sections that came out empty/weird when data was present
- [ ] Sections that printed incorrectly when data was absent
- [ ] Formatting that doesn't render well (tables, lists, code blocks)
- [ ] Anti-hallucination rules that didn't fire when they should have
- [ ] Cases where the LLM picked a different tool than what `SKILL.md` prescribes

### Task 4 — Iterate on SKILL.md based on real output

For each gap found in Task 3, tighten `SKILL.md`. Examples of what
"tightening" looks like:

- The output said "Q1 averaged 50k per deal" but you can't tell from the
  response if that's right → **add a rule**: "Compute averages explicitly:
  `total_revenue / deal_count`. Do not eyeball or estimate."
- The "Top deal" line came up empty when there were deals → **add a rule**:
  "If `partner_artifacts(action: 'deals')` returns ≥1 deal, pick the one
  with highest `value` field (or whichever field holds dollar amount, per
  Task 2). NEVER print 'Top deal: N/A' if the response has deals."
- A section printed "$NaN" → **add a rule**: "Skip any metric whose source
  field is `null` or `undefined` — print 'N/A' as a placeholder."

Re-run the skill after each iteration on the **same** test partner. The
output should stabilize after 2–3 iterations.

Then run on a **second** test partner (different data). The skill should
produce a similarly-structured output without further tuning. If it doesn't,
the template is still under-specified — iterate.

Finally, run on the empty-data partner. Sections with no data should
gracefully say "No <X> data for this period" per anti-hallucination rule 1.

### Task 5 — (Optional) Commit a sanitized golden output

If the skill is producing solid output, sanitize one real run and commit
it as `skills/generate-qbr/examples/q1-2026-acme-partner.md`. Replace:

- Real partner names → `Beta Solutions`, `Acme Industries`, etc.
- Real deal names → `Project Atlas`, `Acme Renewal`, etc.
- Real dollar amounts → round numbers in the same order of magnitude
- Real partner_ids → `1721_test_partner_id`

Why bother:
- Regression test reference if `SKILL.md` changes
- Marketing artifact for the marketplace listing
- Onboarding doc for first-time users ("here's what you get")

### Task 6 — Update plugin.json + commit

Once the skill is solid:

- [ ] Bump `plugin.json` version from `0.1.0` to `0.2.0` (minor: first
  validated skill)
- [ ] Update the README status table — `generate-qbr` row should remain
  "✅ Available" but add a note "(validated against staging YYYY-MM-DD)"
- [ ] Delete this `PLAN.md` (its job is done)
- [ ] Commit + push directly to `main` (this repo's convention — no PR
  for in-progress work, only for external contributors)

Suggested commit message:

```
feat(generate-qbr): validate against staging and tighten output template

Cross-checked all 7 tool calls + params against
euler-mcp/src/catalog/tools.ts (commit <sha>). Tightened the output
template after [N] staging runs across [N] partners + 1 empty-data
scenario. Added [N] anti-hallucination rules for [cases].

Plugin version: 0.1.0 → 0.2.0.
```

---

## Constraints — do NOT

- **Do not invent MCP tools or params.** If the catalog doesn't have it,
  you can't use it. Open an issue on `euler-mcp` if something is missing.
- **Do not couple the skill to Bubble workflow names.** All references go
  through the public MCP tool name (e.g. `list_accounts`, never
  `tool_get_user_accounts`). The MCP abstracts Bubble — the skill stays
  abstracted too.
- **Do not change the trigger phrases** (the "When to use this skill"
  section) without a strong reason. Those are the user's invocation
  contract.
- **Do not relax the anti-hallucination rules.** You can tighten them
  (add more), never loosen.
- **Do not commit real customer data** to the examples folder. Sanitize.
- **Do not ship to `main` without testing against staging at least once.**

## Out of scope (logged for later versions)

| Feature | Reason deferred | Target version |
|---------|-----------------|----------------|
| Quarter-over-quarter comparison | Doubles tool-call volume; needs design for delta presentation | v0.3 |
| Multi-partner batch QBR ("QBR for all my partners") | Needs rate-limit-aware looping + summary index | v0.4 |
| Google Docs / Notion export | Requires combining with another connector | v1.0 |
| Custom QBR template per customer | Needs Bubble-side settings + new MCP tool | v1.x |
| Localization | EN-only for v0.x. PT/ES on roadmap once the EN version stabilizes | v1.x |

## Done when (definition of done)

- [ ] All 7 tool calls in `SKILL.md`'s orchestration table match the live
  MCP catalog exactly (Task 1 ✓)
- [ ] All response-field references in the output template are verified
  (Task 2 ✓)
- [ ] Skill runs cleanly on staging for ≥2 partners + 1 empty-data
  scenario (Task 3 ✓)
- [ ] Output is stable across re-runs on the same data (Task 4 ✓)
- [ ] `plugin.json` bumped to `0.2.0`
- [ ] This `PLAN.md` deleted
- [ ] Commit pushed to `main`

## Open questions for the human (ask before proceeding)

1. **Test account credentials** — which sandbox EULER account should be used
   for end-to-end testing? Hand over login or a `partner_id` known to have
   data + a `partner_id` known to be empty.
2. **Sanitization conventions** — if Task 5 is done, are there specific
   partner-name / deal-name conventions to use in the golden example, or
   is "Beta Solutions × Acme Industries" fine?
3. **MCP catalog snapshot** — should the SKILL.md pin to a specific MCP
   version (e.g. `requires: euler-mcp >= 0.4.0`) or stay loose? Loose is
   easier to maintain; pinned is safer against breaking changes.
