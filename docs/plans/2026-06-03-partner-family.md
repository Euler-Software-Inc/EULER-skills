# Partner self-service family Implementation Plan (4 skills, 1 PR)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the remaining partner self-service skills — `my-referrals`, `my-deals` (reads), `submit-a-referral`, `my-tracking-links` (writes) — in the `euler` plugin, in one PR.

**Architecture:** Each skill follows the established folder pattern (`SKILL.md` + `assets/{styles.css,template.html}` + `references/{account-gate,mcp-field-paths}.md` + `examples/`), partner-required gate, self-scoped, multilingual, modern template. Reads render a full HTML report; writes render a compact confirmation card and follow the W1–W6 write discipline. Models to clone: `skills/my-performance/` (reads) and the spec's write sections.

**Tech Stack:** Markdown + HTML/CSS. Gate: `claude plugin validate --strict` + structural greps (no pytest).

**Spec:** [`docs/specs/2026-06-03-partner-family-design.md`](../specs/2026-06-03-partner-family-design.md) — the contract; read the relevant section per skill.

**Branch:** `dev`. Git account: `kennedyeuler`. Build all four, then ONE PR + one version bump (0.15.0 → 0.16.0).

---

## File Structure
```
skills/my-referrals/        # NEW (read)  — referrals(for_partner) worklist
skills/my-deals/            # NEW (read)  — partner_artifacts(deals) pipeline
skills/submit-a-referral/   # NEW (write) — get_form_for_partner → submit_referral; confirmation card
skills/my-tracking-links/   # NEW (write) — partner_artifacts(tracking_links) + create_tracking_link; link card
.claude-plugin/{plugin,marketplace}.json  # MODIFY — keywords + version (end)
README.md                                 # MODIFY — 4 new rows (end)
```

**Common scaffold (every skill):** `cp skills/my-performance/assets/styles.css skills/<name>/assets/styles.css`; fix line 1 + line 9 header to `<name>`; each skill's `references/account-gate.md` = the partner gate adapted (customer-only redirect points to the relevant sibling); `references/mcp-field-paths.md` = the tool paths for that skill. Model the SKILL.md structure + the multilingual note + the partner gate on `skills/my-performance/SKILL.md`. Verify each: styles `diff` OK, no `<img>`, no dead classes (`tldr|stats-grid|prio-badge|section-prose|row`), `claude plugin validate --strict` ✔.

---

## Task 1: my-referrals (READ)

**Frontmatter (verbatim):**
```markdown
---
name: my-referrals
description: List a partner's own submitted referrals and deal registrations with one customer and where each stands (pending / approved / rejected), using EULER MCP tools. Use this skill whenever a partner wants to see the referrals they've sent — phrases like "my referrals", "what referrals did I submit", "status of my referrals", "my deal registrations", "did my referral get approved". Partner-facing (a partner viewing their OWN referrals), NOT a customer admin triaging the queue — that distinction selects this over pending-approvals-triage.
---
```
**Build:** scaffold (common). Orchestration: `list_accounts` (gate + partner_id) → `referrals(action:'for_partner', partner_id)`. Output (full report, model on `my-performance`): hero quick-facts (Total · Pending · Approved · Most-recent) + a `.table-wrap` worklist (Company · Type · Status pill · Submitted), most-recent first; positive empty state; CTA note to `/euler:submit-a-referral`. `references/mcp-field-paths.md`: `referrals(for_partner)` returns the partner's referrals; `Submitted On` is a real date; loose-JSON parse (comma/colon `result_per_page` quirk); status values surfaced verbatim. SKILL.md per spec §1 + shared conventions. Add an `examples/` run. Verify + commit each artifact (`feat(my-referrals): ...`).

## Task 2: my-deals (READ)

**Frontmatter (verbatim):**
```markdown
---
name: my-deals
description: Show a partner's own deal pipeline with one customer — open deals by stage with amounts, plus closed-won/lost — using EULER MCP tools. Use this skill whenever a partner wants their deals view — phrases like "my deals", "my pipeline", "what deals do I have open", "my deal pipeline", "look up my <deal name> deal". Partner-facing (a partner viewing their OWN deals); for a full self scorecard use my-performance, for a customer admin's review use generate-qbr.
---
```
**Build:** scaffold (common). Orchestration: `list_accounts` → `partner_artifacts(action:'deals', partner_id)` (the list); `get_search_deals(deal_name, partner_id)` ONLY when the user names a specific deal. Output (full report): hero quick-facts (Open count · Open value · Closed-won · Avg size) + a `.table-wrap` of open deals grouped by stage (Stage · Deal · Amount) + a `.dist` of stage counts. **Aging only from `last_stage_change_date` durations < 9999 days** (≥9999 = sentinel → never render). Closed-lost omitted if $0. `references/mcp-field-paths.md`: `partner_artifacts(deals)` fields (`Deal name`, stage, `Amount`, the 9999-day sentinel rule); `get_search_deals` is lookup-by-name. SKILL.md per spec §2. Example run. Verify + commit.

## Task 3: submit-a-referral (WRITE ✍️)

**Frontmatter (verbatim):**
```markdown
---
name: submit-a-referral
description: Submit a new referral or deal registration on behalf of a partner through chat — fetches the partner's referral form, collects the answers, and sends it via EULER MCP tools. Use this skill whenever a partner wants to register/submit a referral or deal — phrases like "submit a referral", "register a deal", "send a new referral", "I want to refer a company", "register <company> as a deal". Partner-facing write action (only a partner can submit their own referrals — a customer admin cannot).
---
```
**Build:** scaffold (common). **Flow (SKILL.md — exact, per spec §3):** `list_accounts` (gate + partner_id) → `referrals(action:'get_form_for_partner', partner_id)` (→ `form_id` + `questions[]` each with `answer_field` + `presentation_guidance`) → present questions following `presentation_guidance`, collect every required answer → **confirm with the user** → `submit_referral(partner_id, form_id, answers)` where `answers` = `[{question_id, answer_text, multiselect_options[]}]` (value in the field the question's `answer_field` names; only true multi-select uses `multiselect_options`).
**Write discipline (call out prominently in SKILL.md):** ONE `submit_referral` call per request; **NEVER poll/retry it** (30-orphan incident); the MCP preflight validates — trust it; `form_id_mismatch` → re-fetch the form (re-run step 2) and retry once with the fresh id, not a blind loop; customer-admins are blocked by the gate.
**`references/mcp-field-paths.md`:** the get_form_for_partner response (form_id, questions[].answer_field, presentation_guidance) + the submit_referral answers shape + the form_id_mismatch behavior.
**Output — compact confirmation card** `assets/template.html` (verbatim):
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Referral submitted — {{REFERRED}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>/* Inline the FULL contents of assets/styles.css here. Text wordmark; no JS/images. Set <html lang> to the report language. */</style>
</head>
<body>
<header class="topbar"><div class="container topbar-inner"><div class="brand">
  <span class="brand-mark">Euler</span><span class="brand-divider" aria-hidden="true"></span>
  <span class="brand-label">Referral submitted · {{CUSTOMER}}</span>
</div></div></header>
<section class="hero"><div class="container">
  <span class="hero-eyebrow"><span class="dot" aria-hidden="true"></span>{{STATUS}}</span>
  <h1>Referral sent — <span class="accent">{{REFERRED}}</span></h1>
  <p>{{ONE_LINE_CONFIRMATION}}</p>
  <div class="quick-facts">
    <div class="fact"><div class="fact-label">Type</div><div class="fact-value" style="font-size:clamp(15px,3vw,18px)">{{TYPE}}</div></div>
    <div class="fact"><div class="fact-label">Submitted to</div><div class="fact-value" style="font-size:clamp(15px,3vw,18px)">{{CUSTOMER}}</div></div>
    <div class="fact"><div class="fact-label">Status</div><div class="fact-value" style="font-size:clamp(15px,3vw,18px)">{{STATUS}}</div></div>
  </div>
</div></section>
<section style="padding-top:0"><div class="container">
  <div class="section-header"><div class="section-eyebrow">What you submitted</div></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Question</th><th>Your answer</th></tr></thead>
    <tbody>
      <tr><td><strong>{{Q1}}</strong></td><td>{{A1}}</td></tr>
    </tbody>
  </table></div>
  <p class="note">{{NEXT_STEP_NOTE}}</p>
</div></section>
<footer><div class="container footer-inner">
  <span class="brand-mark footer-mark">Euler</span><p>Referral · {{CUSTOMER}}</p><p class="mono">euler · submit-a-referral</p>
</div></footer>
</body>
</html>
```
SKILL.md per spec §3 (multilingual; second-person; the flow + discipline). On error, do NOT render a "submitted" card — surface the friendly reason + fix. Example run (show the form→confirm→submit flow). Verify + commit.

## Task 4: my-tracking-links (WRITE — idempotent)

**Frontmatter (verbatim):**
```markdown
---
name: my-tracking-links
description: Create and list a partner's own affiliate tracking links with one customer — wraps a destination URL with an auto-generated tracking id — using EULER MCP tools. Use this skill whenever a partner wants a tracking/affiliate link — phrases like "create a tracking link", "make me an affiliate link", "my tracking links", "a link for my <campaign> campaign", "track this URL". Partner-facing (a partner managing their OWN links).
---
```
**Build:** scaffold (common). Orchestration: `list_accounts` (gate + partner_id) → to LIST: `partner_artifacts(action:'tracking_links', partner_id)`; to CREATE: `create_tracking_link(partner_id, url, label, [extras])`. Require an explicit `url` + `label` from the user (confirm) before creating. `extras` = `key<>value` strings. Handle the returned `{link, status, AI_instruction}`: `Created` (show the new `link`), `Duplicated` (surface `AI_instruction`'s existing URL + message — do not claim a new link was made), `Error` (surface `AI_instruction`). One create call per request, no polling.
**`references/mcp-field-paths.md`:** `partner_artifacts(tracking_links)` list shape; `create_tracking_link` params (url, label, extras `key<>value`) + the three statuses + idempotency-by-label.
**Output — compact link card** `assets/template.html` (verbatim):
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tracking link — {{LABEL}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>/* Inline the FULL contents of assets/styles.css here. Text wordmark; no JS/images. Set <html lang> to the report language. */</style>
</head>
<body>
<header class="topbar"><div class="container topbar-inner"><div class="brand">
  <span class="brand-mark">Euler</span><span class="brand-divider" aria-hidden="true"></span>
  <span class="brand-label">Tracking link · {{CUSTOMER}}</span>
</div></div></header>
<section class="hero"><div class="container">
  <span class="hero-eyebrow"><span class="dot" aria-hidden="true"></span>{{STATUS}}</span>
  <h1><span class="accent">{{LABEL}}</span></h1>
  <p>{{ONE_LINE}} <span class="mono" style="word-break:break-all">{{LINK}}</span></p>
</div></section>
<section style="padding-top:0"><div class="container">
  <div class="section-header"><div class="section-eyebrow">Your tracking links</div></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Label</th><th>Link</th></tr></thead>
    <tbody>
      <tr><td><strong>{{LABEL}}</strong></td><td class="mono" style="word-break:break-all">{{LINK}}</td></tr>
    </tbody>
  </table></div>
  <p class="note">{{NOTE}}</p>
</div></section>
<footer><div class="container footer-inner">
  <span class="brand-mark footer-mark">Euler</span><p>Tracking links · {{CUSTOMER}}</p><p class="mono">euler · my-tracking-links</p>
</div></footer>
</body>
</html>
```
SKILL.md per spec §4 (multilingual; the create/list flow; status handling). Example run. Verify + commit.

## Task 5: wiring + version bump (once, after all four)

- `.claude-plugin/plugin.json`: `"version": "0.15.0"` → `"0.16.0"`; add keywords `"referrals"` (if absent), `"deals"`, `"tracking-links"`.
- `.claude-plugin/marketplace.json`: both versions → `"0.16.0"`; add the same keywords/tags.
- `README.md`: add 4 rows (my-referrals, my-deals, submit-a-referral, my-tracking-links), each marked partner-facing; note the 2 writes.
- Verify: `grep -n '"version"'` → all `0.16.0`.
- Commit: `chore(release): partner self-service family (referrals, deals, submit-a-referral, tracking-links); v0.16.0`.

## Task 6: validate, final review, ONE PR

- `claude plugin validate .claude-plugin/plugin.json --strict` + `claude plugin validate . --strict` + full-temp validate → all ✔.
- Sweep: all 6 stylesheets byte-identical in body; no `<img>`/dead classes across the 4 new skills.
- **Dispatch a final spec+quality review** of the 4 skills against `docs/specs/2026-06-03-partner-family-design.md` (gates, self-scoped, write discipline on the 2 writes [one call, no polling, form_id_mismatch handling, status handling], multilingual, no dead classes). Fix must-fixes.
- Push `dev`; open ONE PR dev→main: title `feat: partner self-service family — referrals, deals, submit-a-referral, tracking-links (v0.16.0)`; body summarizing the 4 skills, the write discipline, and the validation.

## Notes for the implementer
- **No pytest.** Gate = `claude plugin validate --strict` + greps.
- **Writes:** ONE call per action, NEVER poll/retry (the 30-orphan-referral lesson). On error, never render a success card.
- **Reuse, don't reinvent:** model every skill on `skills/my-performance/` + `skills/my-onboarding/` for the gate, multilingual note, and template/CSS boilerplate; the spec is the per-skill contract.
- English SKILL.md; multilingual rendered output. Design-system classes only.
