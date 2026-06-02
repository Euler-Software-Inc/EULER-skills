# my-onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `my-onboarding`, the first partner-facing EULER skill — a partner sees their own onboarding/certification progress (what's done, left, overdue) as a self-contained HTML report.

**Architecture:** A folder-wrapped skill cloning the established pattern (`SKILL.md` + `assets/{styles.css,template.html}` + `references/`). Orchestrates `list_accounts` → `partner_flow_details` → `partner_flow_progress`×N (all `scope: partner`). Output uses the modern Euler design-system template (text wordmark) plus one new additive `.progress` bar component synced across all five skill stylesheets.

**Tech Stack:** Markdown SKILL.md (frontmatter-driven discovery), hand-authored HTML/CSS (no JS, no build), Claude Code plugin manifest (`plugin.json` + `marketplace.json`). Quality gate: `claude plugin validate --strict`.

**Spec:** [`docs/specs/2026-06-02-my-onboarding-design.md`](../specs/2026-06-02-my-onboarding-design.md). Read it before starting.

**Branch:** work on `dev` (the integration branch). Plugin account for git ops: `kennedyeuler` (run `gh auth switch --user kennedyeuler` if a push/PR 404s).

---

## File Structure

```
skills/my-onboarding/
  SKILL.md                       # NEW — orchestration + output rules + partner gate
  assets/styles.css              # NEW — copy of canonical sheet (incl. new .progress)
  assets/template.html           # NEW — Approach-A skeleton
  references/account-gate.md     # NEW — partner-side gate variant
  references/mcp-field-paths.md  # NEW — flow-tool field paths + JSON-concat quirks
  examples/2026-06-my-onboarding-sample.md  # NEW — one illustrative (provisional) run
skills/pending-approvals-triage/assets/styles.css  # MODIFY — add .progress (canonical source)
skills/portfolio-pulse/assets/styles.css           # MODIFY — sync .progress
skills/generate-qbr/assets/styles.css              # MODIFY — sync .progress
skills/partner-briefing/assets/styles.css          # MODIFY — sync .progress
.claude-plugin/plugin.json        # MODIFY — keywords + version 0.11.0 → 0.12.0
.claude-plugin/marketplace.json   # MODIFY — keywords + version (×2) → 0.12.0
README.md                         # MODIFY — add my-onboarding to the skill list
```

---

## Task 1: Add the `.progress` component to all five stylesheets

The canonical sheet (`pending-approvals-triage`) is the source of truth; the other four
are byte-identical in body. Add an additive progress-bar component to all five so they
stay in sync.

**Files:**
- Modify: `skills/pending-approvals-triage/assets/styles.css` (canonical)
- Modify: `skills/portfolio-pulse/assets/styles.css`
- Modify: `skills/generate-qbr/assets/styles.css`
- Modify: `skills/partner-briefing/assets/styles.css`

- [ ] **Step 1: Insert the component into the canonical sheet**

In `skills/pending-approvals-triage/assets/styles.css`, insert this block immediately
**before** the `/* ─── Footer ─── */` line:

```css
/* ─── Progress bar (onboarding / completion) ─── */
.progress { height: 8px; background: var(--gray-200); border-radius: 9999px; overflow: hidden; margin: 6px 0 12px; }
.progress > .bar { height: 100%; width: 0; background: var(--brand-600); border-radius: 9999px; }
.progress.green > .bar { background: var(--success-500); }
.progress.amber > .bar { background: var(--warning-500); }
.progress.red   > .bar { background: var(--error-500); }

```

- [ ] **Step 2: Apply the identical block to the other three sheets**

Insert the exact same block (same position, before `/* ─── Footer ─── */`) into:
`skills/portfolio-pulse/assets/styles.css`, `skills/generate-qbr/assets/styles.css`,
`skills/partner-briefing/assets/styles.css`.

- [ ] **Step 3: Verify all four sheets are byte-identical in body**

Run:
```bash
cd /c/Users/Kenny/www/euler/EULER-skills
for s in portfolio-pulse generate-qbr partner-briefing; do
  diff <(sed '1d;9d' skills/pending-approvals-triage/assets/styles.css) \
       <(sed '1d;9d' skills/$s/assets/styles.css) && echo "$s OK" || echo "$s DIFF"
done
```
Expected: `portfolio-pulse OK`, `generate-qbr OK`, `partner-briefing OK` (lines 1 + 9 are the per-skill header comment, intentionally excluded).

- [ ] **Step 4: Commit**

```bash
git add skills/*/assets/styles.css
git commit -m "feat(skills): add .progress bar component to the shared stylesheet"
```

---

## Task 2: Scaffold `my-onboarding/` + its stylesheet

**Files:**
- Create: `skills/my-onboarding/assets/styles.css`

- [ ] **Step 1: Create the skill folder and copy the canonical sheet**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
mkdir -p skills/my-onboarding/assets skills/my-onboarding/references skills/my-onboarding/examples
cp skills/pending-approvals-triage/assets/styles.css skills/my-onboarding/assets/styles.css
```

- [ ] **Step 2: Fix the per-skill header comment (lines 1 and 9)**

In `skills/my-onboarding/assets/styles.css`:
- Line 1: replace `/* pending-approvals-triage — Euler design system, modern report treatment`
  with `/* my-onboarding — Euler design system, modern report treatment`
- Line 9: replace `* Tokens are the Euler design system. Used only by pending-approvals-triage.`
  with `* Tokens are the Euler design system. Used only by my-onboarding.`

- [ ] **Step 3: Verify body matches canonical**

Run:
```bash
diff <(sed '1d;9d' skills/pending-approvals-triage/assets/styles.css) \
     <(sed '1d;9d' skills/my-onboarding/assets/styles.css) && echo "OK"
```
Expected: `OK` (byte-identical body, including the new `.progress` from Task 1).

- [ ] **Step 4: Commit**

```bash
git add skills/my-onboarding/assets/styles.css
git commit -m "feat(my-onboarding): scaffold skill + canonical stylesheet"
```

---

## Task 3: Write `template.html`

**Files:**
- Create: `skills/my-onboarding/assets/template.html`

- [ ] **Step 1: Write the template verbatim**

Create `skills/my-onboarding/assets/template.html` with exactly:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>My Onboarding — {{CUSTOMER}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
/* Inline the FULL contents of assets/styles.css here (self-contained).
   Lightweight: no JS, no images (brand is a text wordmark — the remote
   logo SVG renders broken in Claude); fonts load with display=swap. */
</style>
</head>
<body>

<!-- ─── Topbar (text wordmark) ─── -->
<header class="topbar">
  <div class="container topbar-inner">
    <div class="brand">
      <span class="brand-mark">Euler</span>
      <span class="brand-divider" aria-hidden="true"></span>
      <span class="brand-label">My Onboarding · {{CUSTOMER}}</span>
    </div>
  </div>
</header>

<!-- ─── Hero + quick facts ─── -->
<!-- hero-eyebrow tone (default | amber | red) follows the worst per-flow status -->
<section class="hero">
  <div class="container">
    <span class="hero-eyebrow amber"><span class="dot" aria-hidden="true"></span>{{CUSTOMER}} · {{N}} flows</span>
    <h1>Your onboarding — <span class="accent">{{OVERALL_PCT}}</span> complete</h1>
    <p>{{ONE_LINE_STATE}} <span class="data-pill complete">Complete data</span></p>

    <div class="quick-facts">
      <div class="fact"><div class="fact-label">Flows assigned</div><div class="fact-value">{{N}}</div><div class="fact-sub">{{FLOWS_SUB}}</div></div>
      <div class="fact"><div class="fact-label">Overall complete</div><div class="fact-value">{{OVERALL_PCT}}</div><div class="fact-sub">{{DONE_STEPS}}/{{TOTAL_STEPS}} steps</div></div>
      <div class="fact"><div class="fact-label">Overdue steps</div><div class="fact-value">{{OVERDUE}}</div><div class="fact-sub">{{OVERDUE_SUB}}</div></div>
      <div class="fact"><div class="fact-label">Next due</div><div class="fact-value" style="font-size:clamp(15px,3vw,18px)">{{NEXT_DUE}}</div><div class="fact-sub">{{NEXT_DUE_FLOW}}</div></div>
    </div>
  </div>
</section>

<!-- ─── Spotlight: the one most-urgent move (tone: default | amber | red) ─── -->
<section style="padding-bottom:0">
  <div class="container">
    <div class="spotlight amber">
      <div class="spotlight-inner">
        <span class="spotlight-eyebrow">Do this next</span>
        <h2>{{MOST_URGENT_HEADLINE}}</h2>
        <p>{{MOST_URGENT_DETAIL}} Wrap dates/counts in <span class="num">3 steps</span>-style chips.</p>
      </div>
    </div>
  </div>
</section>

<!-- ─── Per-flow section (repeat; order overdue → due-soon → in-progress → done) ─── -->
<section>
  <div class="container">
    <div class="section-header">
      <div class="section-eyebrow">01 · {{FLOW_TITLE}}</div>
      <h2 class="section-title">{{FLOW_PCT}}% complete <span style="font-weight:400;color:var(--gray-500)">· {{FLOW_DONE}}/{{FLOW_TOTAL}} steps · {{FLOW_TYPE}}</span> <span class="status-pill amber">🟡 In progress</span></h2>
    </div>
    <!-- progress bar: tone class (green|amber|red) matches the flow status; width inline -->
    <div class="progress amber"><div class="bar" style="width:{{FLOW_PCT}}%"></div></div>
    <!-- only the to_do + overdue steps; done collapsed into the header count above -->
    <div class="attention">
      <div class="att-row">
        <div class="att-left"><span class="status-pill red">🔴 Overdue</span><span class="att-name">{{STEP_TITLE}}</span></div>
        <div class="att-meta">{{STEP_TYPE}} · due {{STEP_DUE}}</div>
      </div>
      <!-- …to_do rows use <span class="status-pill gray">⚪ To do</span>; cap the list, footnote overflow… -->
    </div>
    <!-- certification badge line ONLY when certification_badge is a real URL: -->
    <p class="note">🏅 Certification badge earned.</p>
  </div>
</section>

<!-- ─── Footer (text wordmark) ─── -->
<footer>
  <div class="container footer-inner">
    <span class="brand-mark footer-mark">Euler</span>
    <p>My Onboarding · {{CUSTOMER}}</p>
    <p class="mono">euler · my-onboarding</p>
  </div>
</footer>

</body>
</html>
```

- [ ] **Step 2: Verify no `<img>` and only defined classes**

Run:
```bash
grep -nE '<img|brand-logo\.svg' skills/my-onboarding/assets/template.html && echo "FAIL: has image" || echo "OK: wordmark only"
```
Expected: `OK: wordmark only`.

- [ ] **Step 3: Commit**

```bash
git add skills/my-onboarding/assets/template.html
git commit -m "feat(my-onboarding): add Approach-A template.html"
```

---

## Task 4: Write the two reference files

**Files:**
- Create: `skills/my-onboarding/references/account-gate.md`
- Create: `skills/my-onboarding/references/mcp-field-paths.md`

- [ ] **Step 1: Write the partner-side account gate**

Create `skills/my-onboarding/references/account-gate.md`. Model it on
`skills/pending-approvals-triage/references/account-gate.md` but INVERT the role.
It MUST contain:
- The rule: `list_accounts` is step 1; this skill needs a `type === 'partner'` entry.
- Customer-only connection → friendly message + STOP (no raw `forbidden_scope`):
  > "my-onboarding shows your progress as a partner. You're connected as a customer
  > admin — partner onboarding lives in your dashboard: `<dashboard_url>`."
- Multiple partner accounts → pick by `affiliate_company_name`; ask only if ambiguous.
- `partner_id` source rule: from the chosen `type:'partner'` `list_accounts` entry ONLY;
  `partner_directory_search` returns `profile_id` → `partner_not_in_consent` (do not use).
- `forbidden_scope` / `backend_data_issue` translation (surface `support_email`, never the raw code).

- [ ] **Step 2: Write the flow-tool field paths**

Create `skills/my-onboarding/references/mcp-field-paths.md` documenting the exact tool
contracts (source: euler-mcp catalog `src/catalog/tools.ts` + `docs/api-mapping/tools-by-function.md`).
It MUST contain:

```
## partner_flow_details(partner_id)  — scope: partner, read
- No drill-down param → list of flows assigned to the partner (the discovery call).
- `name` → filter assigned flows by title.  `flow_id` → flow details + step IDs.  `flow_step_id` → step details.
- Mutually exclusive drill-down params — pass at most one. Non-assigned flows return empty data.
- partner_id REQUIRED — from list_accounts (type:'partner').

## partner_flow_progress(partner_id, flow_id)  — scope: partner, read
Returns (numbers arrive as STRINGS — Number() before math):
- total_steps, done_count, failed_count, to_do_count, overdue_count
- percent_complete
- done_details / failed_details / to_do_details / overdue_details
    → JSON-string concats of {title, description, type} per step. Parse defensively
      (loose JSON, same posture as referrals). On parse failure, show the count only.
- flow_title, flow_description, flow_type, flow_due_date, flow_due_in_days, flow_id, assignment_id, progress
- certification_badge → a URL when earned; sentinels "Not earned yet." / "No image attached."
    → never render a sentinel as an image. Show "badge earned" only on a real URL.
- A flow_id outside the partner's assignments returns empty counts + empty lists (NOT an error).

## Overall % across flows
Σ done_count / Σ total_steps  (NOT the average of per-flow percents). Zero-denominator → "—".
```

- [ ] **Step 3: Commit**

```bash
git add skills/my-onboarding/references/
git commit -m "feat(my-onboarding): add account-gate + mcp-field-paths references"
```

---

## Task 5: Write `SKILL.md`

**Files:**
- Create: `skills/my-onboarding/SKILL.md`

- [ ] **Step 1: Write the frontmatter verbatim**

The `description` drives skill selection — use exactly:

```markdown
---
name: my-onboarding
description: Generate a partner's own onboarding and certification progress report — what's done, what's left, and what's overdue across the flows assigned to them by one customer, using EULER MCP tools. Use this skill whenever a partner wants their personal onboarding status — phrases like "where am I in my onboarding", "my certification progress", "what onboarding steps do I have left", "am I done with onboarding", "show my training progress". Partner-facing (a partner viewing their OWN progress), NOT a customer admin reviewing partners — that distinction selects this skill over portfolio-pulse / generate-qbr.
---
```

- [ ] **Step 2: Write the body**

Author the body following the structure of `skills/portfolio-pulse/SKILL.md` (the closest
model), with these sections and content drawn from the spec
(`docs/specs/2026-06-02-my-onboarding-design.md`):

1. `# my-onboarding — your onboarding & certification progress` + a one-paragraph "When to use" / "DO NOT use" (route customer-admins to portfolio-pulse; route single-customer deep partner review to generate-qbr).
2. `## Account type — required: partner` — summarize the gate and link
   [`references/account-gate.md`](references/account-gate.md). State the INVERSE gate:
   needs a `type:'partner'` entry; customer-only → friendly redirect + STOP.
3. `## Inputs (optional)` — table from spec §3 (which customer; flow filter). Never block.
4. `## Orchestration sequence` — the table from spec §4 (list_accounts → partner_flow_details
   no-drill → partner_flow_progress per flow). Note the ~8-flow cap + footnote. Link
   [`references/mcp-field-paths.md`](references/mcp-field-paths.md).
5. `## Progress logic` — spec §5 verbatim intent: Overall % = Σdone/Σtotal (state basis;
   zero-denom → "—"); the four per-flow statuses (🟢 Done / 🔴 Overdue / 🟡 In progress /
   ⚪ Not started, first match wins); hero+spotlight tone = worst status; spotlight = most
   urgent step; section order overdue → due-soon → in-progress → done.
6. `## Output format` — point to `assets/styles.css` (inline FULL contents) + `assets/template.html`;
   restate the Euler-design-system + **text-wordmark, no image** + lightweight/mobile rules
   (copy the wording from portfolio-pulse SKILL.md's design-system paragraph); list the
   sections from spec §6 (topbar / hero+quick-facts / spotlight / per-flow with `.progress`
   bar + `.attention` to_do/overdue + badge / footer). Status pill vocabulary table.
7. `## Anti-hallucination rules (not optional)` — the full list from spec §7 (no internal
   IDs; partner_id source; Overall % basis; numerics-as-strings; loose JSON parse of
   `*_details`; certification_badge sentinels; overdue only from tool data; flag test
   entries keep in counts; one partner+customer; read-only).
8. `## Example user flow` — a worked example: partner with 3 flows, one overdue → the
   sequence of calls + a one-line description of the rendered report.
9. `## Why this skill exists` — one paragraph: progress data is partner-side only; this is
   the partner's self-service onboarding view + the first partner-facing skill.

- [ ] **Step 3: Verify no dead classes leaked into SKILL.md or template**

Run:
```bash
grep -rnE 'class="(header|meta|tldr|stat|stats-grid|row|section-prose|prio-badge)("| )|tldr-|stats-grid|prio-badge|section-prose|row-name' skills/my-onboarding/ && echo "FAIL" || echo "OK: no dead classes"
```
Expected: `OK: no dead classes`.

- [ ] **Step 4: Commit**

```bash
git add skills/my-onboarding/SKILL.md
git commit -m "feat(my-onboarding): add SKILL.md (orchestration + output + partner gate)"
```

---

## Task 6: Write the example run

**Files:**
- Create: `skills/my-onboarding/examples/2026-06-my-onboarding-sample.md`

- [ ] **Step 1: Write one illustrative example**

Model on an existing `skills/*/examples/*.md`. Show a sanitized scenario: a partner
("Lumon Industries") with 3 assigned flows (one Onboarding 100% done, one Certification
60% with 1 overdue step, one Custom To-Do not started), the call sequence, and the
resulting report shape. Add a header note: **"Illustrative — response shapes are
provisional (spec §9); refresh against a real run once available."**

- [ ] **Step 2: Commit**

```bash
git add skills/my-onboarding/examples/
git commit -m "docs(my-onboarding): add illustrative example run"
```

---

## Task 7: Wire the plugin (manifest + README) and bump version

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `README.md`

- [ ] **Step 1: plugin.json — version + keywords**

In `.claude-plugin/plugin.json`:
- Change `"version": "0.11.0"` → `"version": "0.12.0"`.
- In `keywords`, add `"onboarding"` and `"certification"` (keep existing entries).

- [ ] **Step 2: marketplace.json — version (×2) + keywords/tags**

In `.claude-plugin/marketplace.json`:
- Change both `"version": "0.11.0"` occurrences (metadata + plugin entry) → `"0.12.0"`.
- Add `"onboarding"`, `"certification"` to the plugin entry's `tags` and `keywords`.

- [ ] **Step 3: README — add the skill to the list**

In `README.md`, add a `my-onboarding` row/bullet to the skills list, matching the format
of the existing entries (one-line description + partner-facing audience note).

- [ ] **Step 4: Verify versions are consistent**

Run:
```bash
grep -n '"version"' .claude-plugin/plugin.json .claude-plugin/marketplace.json
```
Expected: all three show `0.12.0`.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md
git commit -m "chore(release): wire my-onboarding + bump 0.11.0 -> 0.12.0"
```

---

## Task 8: Validate the plugin and open the PR

**Files:** none (verification + PR).

- [ ] **Step 1: Validate the plugin manifest `--strict`**

Run:
```bash
cd /c/Users/Kenny/www/euler/EULER-skills
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate . --strict
```
Expected: both `✔ Validation passed`.

- [ ] **Step 2: Validate the full plugin (temp dir incl. all skills + .mcp.json)**

Run:
```bash
TMP=$(mktemp -d); mkdir -p "$TMP/.claude-plugin"
cp .claude-plugin/plugin.json "$TMP/.claude-plugin/plugin.json"
cp -r skills "$TMP/skills"; cp .mcp.json "$TMP/.mcp.json"
claude plugin validate "$TMP" --strict; echo "exit $?"; rm -rf "$TMP"
```
Expected: `✔ Validation passed`, `exit 0`.

- [ ] **Step 3: Final structural sweep**

Run:
```bash
# all 5 stylesheets byte-identical in body
for s in portfolio-pulse generate-qbr partner-briefing my-onboarding; do
  diff <(sed '1d;9d' skills/pending-approvals-triage/assets/styles.css) \
       <(sed '1d;9d' skills/$s/assets/styles.css) >/dev/null && echo "$s OK" || echo "$s DIFF"
done
# no images / dead classes anywhere in the new skill
grep -rnE '<img|brand-logo\.svg' skills/my-onboarding/ || echo "no images OK"
```
Expected: four `OK` lines + `no images OK`.

- [ ] **Step 4: Push and open the PR**

```bash
gh auth switch --user kennedyeuler   # if needed
git push origin dev
gh pr view 5 -R Euler-Software-Inc/EULER-skills --json state --jq .state
```
If PR #5 (the template-migration PR) is still **OPEN**, these commits are added to it —
acceptable (same `dev`→`main` PR). If it was **MERGED**, open a fresh PR:
```bash
gh pr create -R Euler-Software-Inc/EULER-skills --base main --head dev \
  --title "feat: my-onboarding skill (first partner-facing) + v0.12.0" \
  --body "Adds the my-onboarding partner-facing skill per docs/specs/2026-06-02-my-onboarding-design.md. New .progress component synced across all 5 stylesheets. Bumps to v0.12.0. Validated --strict."
```

- [ ] **Step 5: Confirm checks green**

Run: `gh pr checks <PR#> -R Euler-Software-Inc/EULER-skills`
Expected: validation/CI checks pass (or no required checks configured).

---

## Notes for the implementer

- **No build, no tests-as-code.** The quality gate is `claude plugin validate --strict`
  + the structural greps above. Treat a grep `FAIL` or a non-`✔` validation as a red test.
- **Provenance discipline:** the `partner_flow_*` response shapes are catalog-derived,
  not seen live (spec §9). Keep them in `references/mcp-field-paths.md`, mark the example
  illustrative, and don't invent fields beyond those documented.
- **English-only UI copy** (Euler standing rule) — all rendered strings in the template +
  examples are English.
- **Follow-up (not in this plan):** open a euler-mcp note for the two tools that would
  unblock the customer-side `onboarding-coverage` skill — a "list all flows" enumerator
  and customer-scoped per-partner progress.
