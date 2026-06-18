# Skill template optimization — design spec

> Date: 2026-06-18 · repo `Euler-Software-Inc/EULER-skills` · branch `dev`
> Process: superpowers:brainstorming → writing-plans

**Goal:** Make the skill HTML templates lighter and faster for Claude to generate —
keeping the **exact same Euler visual style** (pixel-identical output) — by leaning the
inlined CSS, shortening high-frequency variable/class names (mnemonic, still readable),
replacing repeated inline styles with utility classes, and marking clearly-replicable
blocks. Unify the 9 divergent stylesheets behind one canonical lean stylesheet.

**Architecture:** A single canonical `core/report.css` (lean) is the source of truth;
a **byte-identical copy** lands in each `<skill>/assets/styles.css` (the file SKILL.md
already tells Claude to inline). The `check-core-sync.mjs` guard is extended to assert
all 9 copies == canonical. Templates stay per-skill (structure differs) but follow lean
conventions. No SKILL.md output contract changes except class/token name updates.

---

## Survey findings (verified 2026-06-18)

- **All 9 skills share the identical 39-class component set.** `generate-qbr`'s
  stylesheet is the complete superset; **zero unique components** in any skill
  (`submit-a-referral` uses a 37-class subset). → one canonical covers all 9 with no
  reconciliation. This is the key de-risk.
- A generated report inlines the **full `styles.css` (~214 lines / ~7KB)** into `<style>`
  **every time** + ~150–200 lines of HTML structure → Claude emits **~400 lines per
  report**. The inlined CSS is the dominant weight.
- The CSS `:root` defines **~45 color tokens** (brand 50→950, gray 50→950, 3×5 status,
  violet/cyan/pink); most are unused per report.
- **Tokens (`--brand-600` …) appear ONLY in CSS.** Renaming/trimming them is fully
  contained to the stylesheet — zero template/SKILL.md impact.
- **Class names appear in CSS + template.html + SKILL.md** (76 class refs across the 9
  SKILL.md files). Renaming a class or swapping an inline style for a utility class
  propagates across all three file types per skill.

## Optimization levers (ranked by win ÷ risk)

1. **CSS lean — biggest, contained to CSS.** Trim unused tokens; strip prose comments
   (keep one header + section dividers); compact whitespace (one rule per line, not one
   property per line); **rename tokens** mnemonically. Touches only `core/report.css` +
   the 9 copies.
2. **Utility classes — kills repeated inline styles.** Replace `style="padding-top:0"`,
   `style="font-weight:400;color:var(--g5)"` etc. with `.pt0`, `.muted`, … Touches CSS +
   templates (+ SKILL.md where it embeds structure).
3. **Mnemonic class rename — moderate.** Shorten high-frequency classes. Touches CSS +
   templates + SKILL.md. Folded into the same per-skill pass as #2 (same blast radius).
4. **Marked replicable blocks — generation ergonomics.** Define each repeatable unit
   once (`<!-- fact · clone, max N -->`, `<!-- row -->`, `<!-- section -->`) so Claude
   clones-and-fills fast and skips/repeats cleanly. Touches templates.

## Naming rules (mnemonic-short, readable)

Definitive map lives in the `core/report.css` header comment (an alias table) so the file
stays self-documenting. Rules:

- **Tokens** — drop the word, keep the family letter + shade: `--brand-600`→`--b6`,
  `--brand-50`→`--b0`, `--brand-950`→`--b95`; `--gray-500`→`--g5`; success/warning/error
  ramps → `--ok5`/`--wn5`/`--er5` (+ `0`/`7` steps); accents → `--vi`/`--cy`/`--pk`;
  `--shadow-md`→`--sh-md`; `--mono` stays. Keep only the shades actually referenced.
- **Classes** — shorten high-frequency, keep meaning: `.quick-facts`→`.qf`,
  `.fact-label/-value/-sub`→`.fl/.fv/.fs`, `.section-header/-eyebrow/-title/-subtitle`→
  `.sh/.se/.st/.ss`, `.hero-eyebrow`→`.he`, `.status-pill`→`.pill`, `.table-wrap`→`.tw`,
  `.data-pill`→`.dp`, `.att-row/-left/-name/-meta`→`.ar/.al/.an/.am`, `.dist-chip`→`.chip`,
  `.spotlight`→`.sl`, `.brand-mark`→`.bm`. Tag selectors (`table/th/td/section`),
  one-word classes (`.fact/.note/.dot/.rank/.bar/.swatch/.num/.mono/.accent`) and tone
  modifiers (`.amber/.red/.green/.gray`) stay as-is.
- **Utility classes:** `.pt0{padding-top:0}` `.pb0{padding-bottom:0}`
  `.mt{margin-top:18px}` `.muted{font-weight:400;color:var(--g5)}` — defined once,
  replace inline `style="…"`.

## Process

**Phase 0 — canonical.** Build `core/report.css`: lean rewrite of the shared 39-class
stylesheet applying the rules above (trim tokens, strip comments, compact, rename, add
utilities). Self-documenting header alias table.

**Phase 1 — pilot `generate-qbr`** (richest skill). Copy canonical → its `assets/styles.css`;
rewrite `template.html` to lean conventions (utility classes, renamed classes, marked
blocks, terse comments); update the class refs in its `SKILL.md`.
- **Validate:** render the pilot with the existing example data and diff against the
  current committed example render — must be **visually identical**. Measure before/after
  bytes + lines per report.
- **Checkpoint:** user signs off on the pilot (render proof + savings) before rolling.

**Phase 2 — roll to the other 8.** Same coordinated pass per skill (copy canonical CSS;
lean template; update SKILL.md class refs). Render-validate each.

**Phase 3 — regenerate examples + showcase.** Regenerate the 9 example renders with the
lean templates and re-sync the showcase embeds, so the showcased output is truthful.

**Phase 4 — guard, gate, PR.** Extend `check-core-sync.mjs` to assert the 9 `styles.css`
== `core/report.css`. Run the gate. PR `dev`→`main`.

## Verification

- **No legacy names remain:** grep across CSS + template.html + SKILL.md returns zero
  pre-rename class names and zero old token names (per skill, and repo-wide).
- **Render parity:** each skill's lean render is visually identical to its current
  example (pilot diffed explicitly; others spot-checked).
- **Guards:** `node scripts/check-core-sync.mjs` OK (model + the 9 styles.css == canonical);
  `claude plugin validate .` + each plugin pass.
- **Size:** report a measured before/after (target ≈ 35–45% fewer bytes/lines per report).

## Out of scope (YAGNI)

- No visual change — output must be pixel-identical.
- No new sections, no JS, no images (text wordmark stays).
- No skill logic/orchestration/trigger-phrase changes — only class/token names, inline-style
  → utility-class swaps, comment/whitespace compaction, and block markers.
- No change to the shared `partner-health-model.md`.

## Risks

- **Missed reference** (a class renamed in CSS but not in a template/SKILL.md, or vice
  versa) → unstyled element. Mitigated by the grep "no legacy names" check per skill +
  render validation.
- **Over-compaction hurting readability** → mitigated by the canonical header alias table
  + keeping one-word/tag/modifier names as-is.
