# Skill Template Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 9 skill HTML templates lighter/faster for Claude to generate while keeping pixel-identical Euler styling — via one canonical lean stylesheet, mnemonic token/class names, utility classes, and marked replicable blocks.

**Architecture:** Canonical `core/report.css` (lean) → byte-identical copy in each `<skill>/assets/styles.css`; per-skill `template.html` leaned; `SKILL.md` class refs updated; `check-core-sync.mjs` extended to guard the CSS copies. Pilot `generate-qbr` with render-parity sign-off before rolling to the other 8.

**Tech Stack:** Static HTML/CSS (no JS, no build), Node guard script, git on `dev`. Spec: `docs/specs/2026-06-18-template-optimization-design.md`.

**Verification model:** no unit framework. "Tests" = grep "no legacy names", render-parity in the Claude Preview, byte/line measurement, `node scripts/check-core-sync.mjs`, `claude plugin validate`.

---

## File Structure

- `core/report.css` — **NEW** canonical lean stylesheet (source of truth; ~150 lines target).
- `partner-managers/skills/{generate-qbr,partner-briefing,portfolio-pulse,pending-approvals-triage}/assets/styles.css` — replaced by canonical copy.
- `partners/skills/{my-performance,my-onboarding,my-referrals,my-deals,submit-a-referral}/assets/styles.css` — replaced by canonical copy.
- `<each skill>/assets/template.html` — leaned (renamed classes, utility classes, marked blocks).
- `<each skill>/SKILL.md` — class refs renamed (76 refs across 9 files).
- `<each skill>/examples/*.html` — regenerated with lean output (Phase 3).
- `scripts/check-core-sync.mjs` — extended to assert the 9 styles.css == `core/report.css`.
- `showcase/index.html` — example embeds re-synced (Phase 3).

## Rename maps (the deterministic contract)

**Tokens** (CSS-only). Pattern: family letter + shade digit; `50`→`0`, `950`→`95`.

```
--brand-{50,100,200,300,400,500,600,700,800,900,950} -> --b{0,1,2,3,4,5,6,7,8,9,95}
--gray-{50..950}                                      -> --g{0..9,95}
--error-{50,100,500,600,700}    -> --er{0,1,5,6,7}
--warning-{50,100,500,600,700}  -> --wn{0,1,5,6,7}
--success-{50,100,500,600,700}  -> --ok{0,1,5,6,7}
--violet-{50,500,700}           -> --vi{0,5,7}
--cyan-{50,500,700}             -> --cy{0,5,7}
--pink-{50,500,700}             -> --pk{0,5,7}
--white -> --w        --mono -> --mono (keep)
--shadow-{xs,sm,md,xl} -> --sh{0,1,2,3}
```
Then **drop any token with zero `var(--x)` references** after the rename.

**Classes** (CSS + template.html + SKILL.md). Rename these; **keep** tag selectors
(`table/th/td/section`), one-word semantic classes (`.hero/.dot/.accent/.num/.note/.bar/.rank/.dist/.k/.v/.mono`), and tone modifiers (`.green/.amber/.red/.gray/.violet/.cyan/.pink/.brand/.top/.complete/.partial/.stale/.numeric`):

```
.container->.ct        .topbar->.tb         .topbar-inner->.tbi
.brand->.br            .brand-mark->.bm     .brand-divider->.bd    .brand-label->.bl
.hero-eyebrow->.he     .quick-facts->.qf
.fact->.ft             .fact-label->.fl     .fact-value->.fv       .fact-sub->.fs
.section-header->.sh   .section-eyebrow->.se .section-title->.st   .section-subtitle->.ss
.spotlight->.sl        .spotlight-inner->.sli .spotlight-eyebrow->.sle
.status-pill->.pill    .table-wrap->.tw      .cell-note->.cn
.attention->.att       .att-row->.ar        .att-left->.al         .att-name->.an   .att-meta->.am
.dist-chip->.chip      .swatch->.sw         .data-pill->.dp
.progress->.pg         .footer-inner->.fi   .footer-mark->.fm
```

**Utility classes** (NEW — replace repeated inline `style="…"`):
```
.pt0{padding-top:0}  .pb0{padding-bottom:0}  .mt{margin-top:18px}
.muted{font-weight:400;color:var(--g5)}
```

---

### Task 1: Build the canonical `core/report.css`

**Files:** Create `core/report.css`

- [ ] **Step 1: Create the dir**
```bash
mkdir -p C:/Users/Kenny/www/euler/EULER-skills/core
```

- [ ] **Step 2: Author `core/report.css`**

Produce a lean rewrite of `partner-managers/skills/generate-qbr/assets/styles.css` (the
confirmed 39-class superset) applying, in order:
1. Apply the **token rename map** and the **class rename map** above (every occurrence).
2. Add the **utility classes**.
3. **Strip** the prose `/* … */` comment blocks; keep one 6-line header + the canonical
   **alias table** (so the file is self-documenting) + short `/* ─ section ─ */` dividers.
4. **Compact** formatting: one selector-rule per line (collapse multi-line rule bodies),
   single spaces, no blank lines between related rules.
5. Keep `@import` (fonts), `:root`, all 39 components, the print block — **no rule
   removed**, only renamed/compacted. (Token *trimming* happens in Step 3 of this task.)

- [ ] **Step 3: Trim unused tokens**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node -e "const fs=require('fs');let c=fs.readFileSync('core/report.css','utf8');const defs=[...c.matchAll(/(--[a-z0-9]+)\s*:/g)].map(m=>m[1]);const unused=defs.filter(d=>(c.split('var('+d+')').length-1)===0 && (c.split(d).length-1)<=1);console.log('unused tokens:',unused.join(', ')||'none')"
```
Remove every token listed as unused from `:root`, then re-run until it prints `none`.

- [ ] **Step 4: Sanity — braces balance + size**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node -e "const fs=require('fs');const c=fs.readFileSync('core/report.css','utf8');const o=(c.match(/{/g)||[]).length,cl=(c.match(/}/g)||[]).length;console.log('braces',o,cl,o===cl?'OK':'MISMATCH');const old=fs.readFileSync('partner-managers/skills/generate-qbr/assets/styles.css','utf8');console.log('bytes',old.length,'->',c.length,'('+Math.round((1-c.length/old.length)*100)+'% smaller)')"
```
Expected: braces balanced; canonical noticeably smaller.

- [ ] **Step 5: Commit**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add core/report.css && git commit -m "feat(core): canonical lean report.css (mnemonic tokens/classes, utilities)"
```

---

### Task 2: Pilot — apply to `generate-qbr` + validate render parity

**Files:** `partner-managers/skills/generate-qbr/assets/styles.css` (replace),
`…/generate-qbr/assets/template.html` (lean), `…/generate-qbr/SKILL.md` (class refs)

- [ ] **Step 1: Copy canonical → skill styles.css (byte-exact)**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
cp core/report.css partner-managers/skills/generate-qbr/assets/styles.css
```

- [ ] **Step 2: Lean the template.html**

Rewrite `partner-managers/skills/generate-qbr/assets/template.html`: apply the class
rename map; replace each inline `style="padding-top:0"` → `class="… pt0"`,
`style="padding-bottom:0"` → `pb0`, `style="margin-top:18px"` → `mt`,
`style="font-weight:400;color:var(--g5)"` (was `--gray-500`) → `muted`; condense the long
`<!-- … -->` comments to one-line markers; mark each repeatable unit once:
`<!-- ft · clone, max N -->`, `<!-- row · clone, max 5 -->`, `<!-- sec · copy block -->`.
Keep the `<style>` inline-instruction comment (now pointing at the lean CSS).

- [ ] **Step 3: Update SKILL.md class references**

In `partner-managers/skills/generate-qbr/SKILL.md`, rename every class reference per the
map (e.g. `quick-facts`→`qf`, `status-pill`→`pill`, `section-title`→`st`).

- [ ] **Step 4: Verify NO legacy names remain (the safety net)**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
S=partner-managers/skills/generate-qbr
grep -nE '\b(quick-facts|fact-label|fact-value|fact-sub|section-header|section-eyebrow|section-title|section-subtitle|hero-eyebrow|status-pill|table-wrap|cell-note|att-row|att-left|att-name|att-meta|dist-chip|data-pill|footer-inner|footer-mark|topbar-inner|brand-mark|brand-divider|brand-label|spotlight-inner|spotlight-eyebrow)\b' $S/assets/template.html $S/SKILL.md $S/assets/styles.css && echo "LEGACY CLASS FOUND" || echo "clean: no legacy classes"
grep -nE '\-\-(brand|gray|error|warning|success|violet|cyan|pink|shadow)-' $S/assets/styles.css && echo "LEGACY TOKEN FOUND" || echo "clean: no legacy tokens"
```
Expected: `clean: no legacy classes` and `clean: no legacy tokens`.

- [ ] **Step 5: Render-parity check in the Claude Preview**

Build a lean render of the existing example: copy `…/generate-qbr/examples/q1-2026-lumon-industries.html` to a scratch file, swap its inlined `<style>` for the new `core/report.css` and rename its classes per the map; open both the **old example** and the **lean render** in the preview; confirm visually identical (same layout, colors, pills, tables) and inspect computed styles on `.qf`/`.pill`/`.tw` to confirm they resolve (not unstyled). Fix any element that lost styling (a missed rename), then re-run Step 4.

- [ ] **Step 6: Measure savings**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node -e "const fs=require('fs');const f=p=>fs.readFileSync(p,'utf8').length;const oldCss=f('partner-managers/skills/generate-qbr/examples/q1-2026-lumon-industries.html');console.log('canonical css bytes:',f('core/report.css'));"
```
Record the before/after per-report byte delta for the sign-off.

- [ ] **Step 7: Commit**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add partner-managers/skills/generate-qbr && git commit -m "refactor(generate-qbr): lean canonical CSS + template + SKILL.md refs"
```

- [ ] **Step 8: CHECKPOINT — user sign-off**

Present render proof (parity) + measured savings. **Do not roll to the other 8 until the
user approves the pilot.**

---

### Task 3: Roll to the remaining 8 skills

Run this exact procedure **once per skill**, in this order:
`partner-managers/skills/partner-briefing`, `…/portfolio-pulse`, `…/pending-approvals-triage`,
`partners/skills/my-performance`, `…/my-onboarding`, `…/my-referrals`, `…/my-deals`, `…/submit-a-referral`.

For each `S=<skill path>`:

- [ ] **Step 1: Copy canonical CSS**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
cp core/report.css "$S/assets/styles.css"
```
- [ ] **Step 2: Lean `$S/assets/template.html`** — apply the class rename map + utility
  classes + block markers (same transformation as Task 2 Step 2; this skill uses a subset
  of the same 39 classes).
- [ ] **Step 3: Update `$S/SKILL.md`** class references per the map.
- [ ] **Step 4: Verify no legacy names** — run Task 2 Step 4's two greps against `$S`. Both must print `clean`.
- [ ] **Step 5: Render spot-check** — open the skill's example (`$S/examples/*.html`) leaned, confirm visual parity + styled.
- [ ] **Step 6: Commit** `git add "$S" && git commit -m "refactor(<skill>): lean canonical CSS + template + SKILL.md refs"`

---

### Task 4: Extend the sync guard to the stylesheets

**Files:** `scripts/check-core-sync.mjs`

- [ ] **Step 1: Add the CSS family to the guard**

Extend `scripts/check-core-sync.mjs` so that, in addition to `partner-health-model.md`, it
asserts each of the 9 `<plugin>/skills/<name>/assets/styles.css` is content-identical
(line-ending normalized) to `core/report.css`. Reuse the existing `sha` helper; print
`OK` with the count or list diverging files and `process.exit(1)`.

- [ ] **Step 2: Run it**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node scripts/check-core-sync.mjs
```
Expected: `OK` for the model (3 copies) **and** the stylesheet (9 copies == canonical).

- [ ] **Step 3: Commit**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add scripts/check-core-sync.mjs && git commit -m "chore(scripts): guard the 9 styles.css against core/report.css"
```

---

### Task 5: Regenerate examples + re-sync showcase (Phase 3)

**Files:** `<each skill>/examples/*.html`, `showcase/index.html`

- [ ] **Step 1: Regenerate each example render** with the lean template + canonical CSS
  (same data, new classes/CSS). Visual parity to the prior example.
- [ ] **Step 2: Re-sync the showcase embeds** — update the embedded report blocks in
  `showcase/index.html` to the regenerated lean renders; then `cp showcase/index.html showcase/showcase-plugin-claude.html`.
- [ ] **Step 3: Verify** showcase renders (preview) + no legacy class names in `showcase/index.html`.
- [ ] **Step 4: Commit** `git add <examples> showcase/index.html && git commit -m "docs: regenerate examples + showcase with lean templates"`

---

### Task 6: Gate + PR

- [ ] **Step 1: Full gate**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node scripts/check-core-sync.mjs
claude plugin validate .
claude plugin validate ./partner-managers
claude plugin validate ./partners
```
Expected: all green.

- [ ] **Step 2: Repo-wide legacy-name sweep**
```bash
cd C:/Users/Kenny/www/euler/EULER-skills
grep -rnE '\b(quick-facts|status-pill|table-wrap|section-title|section-subtitle|hero-eyebrow|att-row|dist-chip|data-pill|footer-inner)\b' partner-managers partners core 2>/dev/null && echo "LEGACY FOUND" || echo "clean repo-wide"
```
Expected: `clean repo-wide` (examples may still match until Task 5 done — run after Phase 3).

- [ ] **Step 3: PR dev→main**
```bash
gh auth switch --user kennedyeuler && gh auth setup-git
cd C:/Users/Kenny/www/euler/EULER-skills
git push origin dev
gh pr create --base main --head dev --title "perf(templates): lean canonical CSS + mnemonic names (v0.18.x)" --body-file docs/specs/2026-06-18-template-optimization-design.md
gh pr merge dev --merge --delete-branch=false
```

---

## Notes for the executor
- **Pixel-identical is the bar.** Any visual change = a missed rename; fix before commit.
- **Use `cp` for the CSS copy** (never Read+Write) so the guard's content check matches.
- **No SKILL.md logic changes** — only class-name refs.
- Bump plugin + marketplace version (patch, e.g. 0.18.1) in Task 6 if not already.
- gh reverts to `kennedysmartins` — switch to `kennedyeuler` before push/PR.
