# my-performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `my-performance` — a partner-facing self-service scorecard (their own EULER health score + key stats + the next lever to improve), as a new skill in the existing `euler` plugin.

**Architecture:** Folder-wrapped skill cloning the established pattern (`SKILL.md` + `assets/{styles.css,template.html}` + `references/`). Partner-required account gate (mirror of `my-onboarding`). Orchestrates the self-scoped QBR subset (`performance`/`partner_artifacts`/`commissions`/`referrals`), computes the partner's own health per the shared `docs/partner-health-model.md` (same plugin — no duplication), and renders a light scorecard in the modern Euler template, in the user's requested language.

**Tech Stack:** Markdown SKILL.md + hand-authored HTML/CSS (no JS, no build). Quality gate: `claude plugin validate --strict` + structural greps (no pytest — content artifact).

**Spec:** [`docs/specs/2026-06-03-my-performance-design.md`](../specs/2026-06-03-my-performance-design.md). Read it first.

**Branch:** work on `dev`. Git account for push/PR: `kennedyeuler` (`gh auth switch --user kennedyeuler` if a 404 appears).

---

## File Structure

```
skills/my-performance/SKILL.md                     # NEW — gate, orchestration, health synergy, output
skills/my-performance/assets/styles.css            # NEW — copy of canonical sheet (incl. .progress)
skills/my-performance/assets/template.html         # NEW — scorecard skeleton
skills/my-performance/references/account-gate.md   # NEW — partner-side gate (redirect → generate-qbr)
skills/my-performance/references/mcp-field-paths.md# NEW — self-scoped field paths
skills/my-performance/examples/2026-06-my-performance-sample.md  # NEW — illustrative run
.claude-plugin/plugin.json                         # MODIFY — keywords + version bump
.claude-plugin/marketplace.json                    # MODIFY — keywords + version (×2)
README.md                                          # MODIFY — add my-performance to the skill list
```

---

## Task 1: Scaffold + stylesheet

**Files:**
- Create: `skills/my-performance/assets/styles.css`

- [ ] **Step 1: Create folders + copy the canonical sheet**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
mkdir -p skills/my-performance/assets skills/my-performance/references skills/my-performance/examples
cp skills/my-onboarding/assets/styles.css skills/my-performance/assets/styles.css
```
(`my-onboarding`'s sheet is the canonical text-wordmark sheet incl. the `.progress` component.)

- [ ] **Step 2: Fix the header comment (lines 1 and 9)**

In `skills/my-performance/assets/styles.css` (Read first, then Edit):
- Line 1 → `/* my-performance — Euler design system, modern report treatment`
- Line 9 → ` * Tokens are the Euler design system. Used only by my-performance.`

- [ ] **Step 3: Verify body matches canonical**

```bash
diff <(sed '1d;9d' skills/my-onboarding/assets/styles.css) <(sed '1d;9d' skills/my-performance/assets/styles.css) && echo "OK"
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add skills/my-performance/assets/styles.css
git commit -m "feat(my-performance): scaffold skill + canonical stylesheet"
```

---

## Task 2: template.html

**Files:**
- Create: `skills/my-performance/assets/template.html`

- [ ] **Step 1: Write the template verbatim**

Create `skills/my-performance/assets/template.html` with exactly:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>My Performance — {{CUSTOMER}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
/* Inline the FULL contents of assets/styles.css here (self-contained).
   Lightweight: no JS, no images (text wordmark — the remote logo SVG renders
   broken in Claude); fonts load with display=swap. Set <html lang> to the
   report language (e.g. pt-BR for a Portuguese request). */
</style>
</head>
<body>

<!-- ─── Topbar (text wordmark) ─── -->
<header class="topbar">
  <div class="container topbar-inner">
    <div class="brand">
      <span class="brand-mark">Euler</span>
      <span class="brand-divider" aria-hidden="true"></span>
      <span class="brand-label">My Performance · {{CUSTOMER}}</span>
    </div>
  </div>
</header>

<!-- ─── Hero — health score front and center (eyebrow/spotlight tone by band) ─── -->
<section class="hero">
  <div class="container">
    <span class="hero-eyebrow amber"><span class="dot" aria-hidden="true"></span>{{WINDOW}} · {{BAND}}</span>
    <h1>Your performance — <span class="accent">{{SCORE}}/100</span> {{BAND}}</h1>
    <p>{{ONE_LINE_READ}} <span class="data-pill complete">Complete data</span></p>

    <div class="quick-facts">
      <div class="fact"><div class="fact-label">Revenue (window)</div><div class="fact-value">{{REVENUE}}</div><div class="fact-sub">{{REVENUE_SUB}}</div></div>
      <div class="fact"><div class="fact-label">Deals closed</div><div class="fact-value">{{DEALS}}</div><div class="fact-sub">{{DEALS_SUB}}</div></div>
      <div class="fact"><div class="fact-label">Commissions</div><div class="fact-value">{{COMMISSIONS}}</div><div class="fact-sub">earned this window</div></div>
      <div class="fact"><div class="fact-label">Referrals</div><div class="fact-value">{{REFERRALS}}</div><div class="fact-sub">{{REFERRALS_SUB}}</div></div>
    </div>
  </div>
</section>

<!-- ─── Spotlight: the read + the next lever (tone by band) ─── -->
<section style="padding-bottom:0">
  <div class="container">
    <div class="spotlight amber">
      <div class="spotlight-inner">
        <span class="spotlight-eyebrow">Your read</span>
        <h2>{{ONE_LINE_READ}}</h2>
        <p>{{NEXT_LEVER}}</p>
      </div>
    </div>
  </div>
</section>

<!-- ─── 01 · Health breakdown — the 5 model factors, one .progress bar each ─── -->
<section>
  <div class="container">
    <div class="section-header">
      <div class="section-eyebrow">01 · Health breakdown</div>
      <h2 class="section-title">{{SCORE}}/100 · {{BAND}}</h2>
      <p class="section-subtitle">How your customer's health model reads you — and where the points are.</p>
    </div>
    <!-- Repeat one block per factor; bar width = contribution ÷ weight × 100. Tone class
         (green ≥80% of weight, amber 40–79%, red <40%). Localize the factor label. -->
    <p style="margin:0 0 4px;font-size:14px"><strong>Production</strong> <span style="color:var(--gray-500)">{{PROD_VAL}}/35</span></p>
    <div class="progress amber"><div class="bar" style="width:{{PROD_PCT}}%"></div></div>
    <p style="margin:0 0 4px;font-size:14px"><strong>Pipeline</strong> <span style="color:var(--gray-500)">{{PIPE_VAL}}/20</span></p>
    <div class="progress amber"><div class="bar" style="width:{{PIPE_PCT}}%"></div></div>
    <p style="margin:0 0 4px;font-size:14px"><strong>Engagement</strong> <span style="color:var(--gray-500)">{{ENG_VAL}}/20</span></p>
    <div class="progress amber"><div class="bar" style="width:{{ENG_PCT}}%"></div></div>
    <p style="margin:0 0 4px;font-size:14px"><strong>Foundation</strong> <span style="color:var(--gray-500)">{{FOUND_VAL}}/15</span></p>
    <div class="progress amber"><div class="bar" style="width:{{FOUND_PCT}}%"></div></div>
    <p style="margin:0 0 4px;font-size:14px"><strong>Recency</strong> <span style="color:var(--gray-500)">{{REC_VAL}}/10</span></p>
    <div class="progress amber"><div class="bar" style="width:{{REC_PCT}}%"></div></div>
    <p class="note">{{CAPS_NOTE}}</p>
  </div>
</section>

<!-- ─── 02 · Pipeline — top open deals ─── -->
<section style="padding-top:0">
  <div class="container">
    <div class="section-header">
      <div class="section-eyebrow">02 · Pipeline</div>
      <h2 class="section-title">Your open pipeline</h2>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Deal</th><th>Stage</th><th class="numeric">Amount</th></tr></thead>
        <tbody>
          <tr><td><strong>{{DEAL_1}}</strong></td><td>{{STAGE_1}}</td><td class="numeric">{{AMOUNT_1}}</td></tr>
          <!-- top 5 by amount; note the rollup if more -->
        </tbody>
      </table>
    </div>
    <p class="note">{{PIPELINE_NOTE}}</p>
  </div>
</section>

<!-- ─── 03 · Commissions — CONDITIONAL: omit if none ─── -->
<section style="padding-top:0">
  <div class="container">
    <div class="section-header">
      <div class="section-eyebrow">03 · Commissions</div>
      <h2 class="section-title">Commissions <span style="font-weight:400;color:var(--gray-500)">({{WINDOW}})</span></h2>
    </div>
    <p class="note" style="font-size:14px;color:var(--gray-700)">{{COMMISSIONS_PROSE}}</p>
  </div>
</section>

<!-- ─── 04 · Referrals — CONDITIONAL: omit if none ─── -->
<section style="padding-top:0">
  <div class="container">
    <div class="section-header">
      <div class="section-eyebrow">04 · Referrals</div>
      <h2 class="section-title">Referrals <span style="font-weight:400;color:var(--gray-500)">(lifetime)</span></h2>
    </div>
    <p class="note" style="font-size:14px;color:var(--gray-700)">{{REFERRALS_PROSE}}</p>
  </div>
</section>

<!-- ─── 05 · Agreements — CONDITIONAL: omit if none; surface unsigned ─── -->
<section style="padding-top:0">
  <div class="container">
    <div class="section-header">
      <div class="section-eyebrow">05 · Agreements</div>
      <h2 class="section-title">Agreements</h2>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Status</th><th>Agreement</th><th class="numeric">Signed</th></tr></thead>
        <tbody>
          <tr><td><span class="status-pill green">🟢 {{AGR_STATUS_1}}</span></td><td><strong>{{AGR_NAME_1}}</strong></td><td class="numeric">{{AGR_SIGNED_1}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- ─── Footer (text wordmark) ─── -->
<footer>
  <div class="container footer-inner">
    <span class="brand-mark footer-mark">Euler</span>
    <p>My Performance · {{CUSTOMER}}</p>
    <p class="mono">euler · my-performance</p>
  </div>
</footer>

</body>
</html>
```

- [ ] **Step 2: Verify no image**

```bash
grep -nE '<img|brand-logo\.svg' skills/my-performance/assets/template.html && echo "FAIL" || echo "OK: wordmark only"
```
Expected: `OK: wordmark only`.

- [ ] **Step 3: Commit**

```bash
git add skills/my-performance/assets/template.html
git commit -m "feat(my-performance): add scorecard template.html"
```

---

## Task 3: reference files

**Files:**
- Create: `skills/my-performance/references/account-gate.md`
- Create: `skills/my-performance/references/mcp-field-paths.md`

- [ ] **Step 1: account-gate.md (partner-side)**

Read `skills/my-onboarding/references/account-gate.md` and adapt it (it's the same partner gate).
Create `skills/my-performance/references/account-gate.md` with the partner-required gate, identical
in logic, EXCEPT the customer-only redirect message points to **generate-qbr**:
> "my-performance shows your own numbers as a partner. You're connected as a customer admin — for a
> partner review use `generate-qbr`, or open your dashboard: `<dashboard_url>`."
Keep: step 1 = `list_accounts`; needs a `type:'partner'` entry; multiple partner accounts → pick by
`affiliate_company_name`; `partner_id` from the partner entry only, never `partner_directory_search`;
`forbidden_scope`/`backend_data_issue` translation.

- [ ] **Step 2: mcp-field-paths.md (self-scoped)**

Create `skills/my-performance/references/mcp-field-paths.md` with EXACTLY:

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add skills/my-performance/references/
git commit -m "feat(my-performance): add account-gate + mcp-field-paths references"
```

---

## Task 4: SKILL.md

**Files:**
- Create: `skills/my-performance/SKILL.md`

- [ ] **Step 1: Read the models**

Read `skills/my-onboarding/SKILL.md` (partner gate + multilingual note + structure model),
`skills/generate-qbr/SKILL.md` (the health-section wording + orchestration table style), and
`docs/specs/2026-06-03-my-performance-design.md` (the contract). Match their voice/depth.

- [ ] **Step 2: Write the frontmatter verbatim**

```markdown
---
name: my-performance
description: Generate a partner's own performance scorecard with one customer — their EULER health score (0–100), key stats (revenue, deals, commissions, referrals), and the single biggest thing to improve — using EULER MCP tools. Use this skill whenever a partner wants their personal performance read — phrases like "how am I doing", "my performance", "my numbers", "my partner scorecard", "how's my pipeline", "am I on track with <customer>". Partner-facing (a partner viewing their OWN numbers), NOT a customer admin reviewing partners — that distinction selects this over generate-qbr / portfolio-pulse.
---
```

- [ ] **Step 3: Write the body**

Sections, content per the spec, matching `my-onboarding`'s depth:
1. `# my-performance — your performance scorecard` + When to use / DO NOT use (customer-admin reviewing a partner → generate-qbr; portfolio-wide → portfolio-pulse; this is the partner's OWN self-view + `/euler:my-performance`).
2. `## Account type — required: partner` — link `references/account-gate.md`; the customer-only redirect points to generate-qbr.
3. `## Inputs (optional)` — which customer (default the only partner account; ask if >1); time window (default 90d; `YYYY-MM-DD`).
4. `## Orchestration sequence` — the 6-call table from spec §4 (list_accounts → performance(partner) → partner_artifacts(deals) → commissions(partner) → referrals(for_partner) → partner_artifacts(agreements)). Link `references/mcp-field-paths.md`. Error handling (reconnect / footnote / gate).
5. `## Your health score` — compute per [`docs/partner-health-model.md`](../../docs/partner-health-model.md) in **full** mode. **Use the exact 5 factors + weights inline** (a table: Production 35 · Pipeline 20 · Engagement 20 · Foundation 15 · Recency 10) — never rename/drop/invent (no "Compliance"). Produce score 0–100 + band + breakdown + the **next lever** (lowest-contribution factor as an action). Caps verbatim. (Copy the hardened wording from `generate-qbr`'s health section, re-framed second-person.)
6. `## Output format` — point to `assets/styles.css` (inline full) + `assets/template.html`; the modern design-system + text-wordmark + lightweight rules (copy from `my-onboarding`); **the multilingual-output note** (render in the requested language; copy from `my-onboarding`); list the template sections (hero with score+band+quick-facts / spotlight read+next-lever / 01 health breakdown with `.progress` bars / 02 pipeline / 03 commissions cond. / 04 referrals cond. / 05 agreements cond.). Band→tone: At-risk→`red`, Watch→`amber`, Healthy/Ramping→default. Second-person tone.
7. `## Anti-hallucination rules (not optional)` — the full list from spec §7.
8. `## Example user flow` — a partner ("Lumon Industries") asks "how am I doing with Martus this quarter" → the call sequence → a one-line description (score 64/100 Watch, next lever = Pipeline, scorecard in the requested language).
9. `## Why this skill exists` — partners have no fast self-read today; this is their scorecard + the partner-facing mirror of QBR, sharing the one health model.

- [ ] **Step 4: Verify**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
grep -c 'docs/partner-health-model.md' skills/my-performance/SKILL.md   # expect >=1
grep -c 'multilingual' skills/my-performance/SKILL.md                   # expect >=1
grep -nE 'class="(tldr|stats-grid|prio-badge|section-prose)("| )' skills/my-performance/SKILL.md && echo "DEAD" || echo "no dead classes OK"
grep -cE 'Production .*35|Pipeline .*20|Engagement .*20|Foundation .*15|Recency .*10' skills/my-performance/SKILL.md  # expect 5 (factors inline)
```
Expected: model link ≥1; multilingual ≥1; `no dead classes OK`; 5 factor lines.

- [ ] **Step 5: Commit**

```bash
git add skills/my-performance/SKILL.md
git commit -m "feat(my-performance): add SKILL.md (partner gate + self-scoped orchestration + own health score)"
```

---

## Task 5: example run

**Files:**
- Create: `skills/my-performance/examples/2026-06-my-performance-sample.md`

- [ ] **Step 1: Write one illustrative example**

Model on `skills/my-onboarding/examples/`. Scenario: partner **Lumon Industries** with customer
**Martus**, last 90 days: 2 deals closed ($28k), $44k open pipeline, 5 referrals, 1 commission,
MNDA signed. Health = 64/100 **Watch**; next lever = Pipeline (low open value). Show the call
sequence (list_accounts → performance → deals → commissions → referrals → agreements) and the
rendered scorecard shape (hero score, spotlight next-lever, the 5 `.progress` bars). Header note:
**"Illustrative — refresh against a real run."**

- [ ] **Step 2: Commit**

```bash
git add skills/my-performance/examples/
git commit -m "docs(my-performance): add illustrative example run"
```

---

## Task 6: plugin wiring + version bump

**Files:**
- Modify: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`

- [ ] **Step 1: Version 0.14.0 → 0.15.0**

`.claude-plugin/plugin.json`: `"version": "0.14.0"` → `"0.15.0"`.
`.claude-plugin/marketplace.json`: BOTH `"version": "0.14.0"` → `"0.15.0"`.

- [ ] **Step 2: Keywords**

Add `"performance"` and `"partner-self-service"` to `plugin.json` `keywords` and to the
marketplace entry's `tags` + `keywords` (keep existing).

- [ ] **Step 3: README**

Add a `my-performance` entry to the skills list, matching the format of siblings; note it's
**partner-facing** (a partner viewing their own scorecard).

- [ ] **Step 4: Verify versions**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
grep -n '"version"' .claude-plugin/plugin.json .claude-plugin/marketplace.json
```
Expected: all three `0.15.0`.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md
git commit -m "chore(release): add my-performance skill; v0.15.0"
```

---

## Task 7: validate, final review, PR

- [ ] **Step 1: Validate `--strict` + structural sweep**

```bash
cd /c/Users/Kenny/www/euler/EULER-skills
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate . --strict
TMP=$(mktemp -d); mkdir -p "$TMP/.claude-plugin"; cp .claude-plugin/plugin.json "$TMP/.claude-plugin/plugin.json"; cp -r skills "$TMP/skills"; cp .mcp.json "$TMP/.mcp.json"
claude plugin validate "$TMP" --strict; echo "exit $?"; rm -rf "$TMP"
diff <(sed '1d;9d' skills/my-onboarding/assets/styles.css) <(sed '1d;9d' skills/my-performance/assets/styles.css) >/dev/null && echo "styles OK" || echo "styles DIFF"
grep -rnE '<img|brand-logo\.svg' skills/my-performance/ || echo "no images OK"
```
Expected: both `✔`; temp `✔` exit 0; `styles OK`; `no images OK`.

- [ ] **Step 2: Dispatch a final spec+quality review** of `skills/my-performance/` against the spec (gate inverse, self-scoped orchestration, health uses exact 5 factors + score, multilingual note, no dead classes, English SKILL.md). Fix any must-fix.

- [ ] **Step 3: Push + PR**

```bash
gh auth switch --user kennedyeuler   # if needed
git push origin dev
gh pr create -R Euler-Software-Inc/EULER-skills --base main --head dev \
  --title "feat: my-performance partner scorecard + v0.15.0" \
  --body "Adds the my-performance partner-facing skill (own health score + key stats + next lever) per docs/specs/2026-06-03-my-performance-design.md. Reuses the shared partner-health model (same plugin, no duplication). Partner-required gate, multilingual output, modern template. Validated --strict."
```

- [ ] **Step 4: Confirm checks** — `gh pr checks <PR#>` (no required checks may be configured — fine).

---

## Notes for the implementer
- **No pytest.** Gate = `claude plugin validate --strict` + the greps. A failing grep / non-`✔` = a red test.
- **Reuse, don't duplicate logic:** the health model is `docs/partner-health-model.md` (same plugin) — link it; render the 5 exact factors inline so Claude doesn't improvise (the lesson from the QBR test).
- **Multilingual:** the scorecard renders in the user's requested language; SKILL.md + CSS stay English.
- **Stays cheap:** ~6 calls, one partner. Read-only — never claim to change anything.
- Keep design-system classes only (incl. `.progress`/`.bar`); no CSS changes.
