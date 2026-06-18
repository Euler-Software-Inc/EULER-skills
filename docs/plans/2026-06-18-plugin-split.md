# EULER-skills Plugin Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the single `euler` plugin into one marketplace with two audience-scoped plugins — `euler-partner-managers` (4 customer-admin skills) and `euler-partners` (5 partner self-service skills) — with no skill-content changes and zero broken references.

**Architecture:** One marketplace (`euler-plugins`) lists two plugins, each a self-contained source subtree (`partner-managers/`, `partners/`) with its own `.claude-plugin/plugin.json`, `.mcp.json`, `docs/`, and `skills/`. The shared `partner-health-model.md` is copied into each plugin's `docs/`, preserving the existing `../../docs/...` links (no SKILL.md edits). A pure-Node script guards the copies against drift.

**Tech Stack:** Claude Code plugin manifests (JSON), Markdown skills, one dependency-free Node (ESM) script. No build system. Git on branch `dev`.

**Verification model:** No unit-test framework exists. "Tests" are: `node scripts/check-core-sync.mjs` (exit 0), `claude plugin validate .` (passes), and structural `grep` checks. Spec: `docs/specs/2026-06-18-plugin-split-design.md`.

---

## File Structure

**New files:**
- `partner-managers/.claude-plugin/plugin.json` — manager-plugin manifest
- `partner-managers/.mcp.json` — euler remote MCP reference (copy)
- `partner-managers/docs/partner-health-model.md` — synced copy of canonical
- `partners/.claude-plugin/plugin.json` — partner-plugin manifest
- `partners/.mcp.json` — euler remote MCP reference (copy)
- `partners/docs/partner-health-model.md` — synced copy of canonical
- `scripts/check-core-sync.mjs` — drift guard for the shared model doc

**Moved (git mv, history preserved):** the 9 skill folders from `skills/<name>/` into `partner-managers/skills/<name>/` (4) and `partners/skills/<name>/` (5).

**Modified:** `.claude-plugin/marketplace.json` (two plugins), `README.md`, `CONTRIBUTING.md`, `showcase/index.html`.

**Deleted:** `.claude-plugin/plugin.json` (root, orphaned), `.mcp.json` (root, superseded by per-plugin copies), the now-empty `skills/` dir.

---

### Task 1: Scaffold the two plugin skeletons

**Files:**
- Create dirs: `partner-managers/{.claude-plugin,docs,skills}`, `partners/{.claude-plugin,docs,skills}`, `scripts`
- Create: `partner-managers/.claude-plugin/plugin.json`, `partners/.claude-plugin/plugin.json`
- Create: `partner-managers/.mcp.json`, `partners/.mcp.json`
- Create (by byte-exact copy): `partner-managers/docs/partner-health-model.md`, `partners/docs/partner-health-model.md`

- [ ] **Step 1: Create the directory tree**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
mkdir -p partner-managers/.claude-plugin partner-managers/docs partner-managers/skills \
         partners/.claude-plugin partners/docs partners/skills scripts
```

- [ ] **Step 2: Write `partner-managers/.claude-plugin/plugin.json`**

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "euler-partner-managers",
  "displayName": "EULER for Partner managers",
  "version": "0.18.0",
  "description": "Skills for partner-relationship managers (customer-admin scope) that orchestrate the EULER MCP: generate a Quarterly Business Review, pre-meeting partner briefings, a whole-portfolio pulse, and approvals triage. Self-contained HTML output styled with the EULER design system.",
  "author": {
    "name": "EULER Software Inc.",
    "email": "support@eulerapp.com",
    "url": "https://eulerapp.com"
  },
  "homepage": "https://eulerapp.com",
  "repository": "https://github.com/Euler-Software-Inc/EULER-skills",
  "license": "MIT",
  "keywords": [
    "euler",
    "partner-management",
    "prm",
    "qbr",
    "quarterly-business-review",
    "partner-briefing",
    "portfolio",
    "approvals",
    "mcp"
  ]
}
```

- [ ] **Step 3: Write `partners/.claude-plugin/plugin.json`**

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "euler-partners",
  "displayName": "EULER for Partners",
  "version": "0.18.0",
  "description": "Self-service skills for partners that orchestrate the EULER MCP: view your own performance scorecard, onboarding and certification progress, referral history and deal registrations, and submit a new referral. Self-contained HTML output styled with the EULER design system.",
  "author": {
    "name": "EULER Software Inc.",
    "email": "support@eulerapp.com",
    "url": "https://eulerapp.com"
  },
  "homepage": "https://eulerapp.com",
  "repository": "https://github.com/Euler-Software-Inc/EULER-skills",
  "license": "MIT",
  "keywords": [
    "euler",
    "partner-self-service",
    "performance",
    "onboarding",
    "certification",
    "referrals",
    "deals",
    "mcp"
  ]
}
```

- [ ] **Step 4: Write `partner-managers/.mcp.json` and `partners/.mcp.json` (identical content)**

```json
{
  "mcpServers": {
    "euler": {
      "url": "https://mcp.eulerapp.com/mcp",
      "type": "http"
    }
  }
}
```

- [ ] **Step 5: Byte-exact copy the canonical model into each plugin**

Use `cp` (NOT Read+Write) so the bytes match exactly — the sync check in Task 4 compares SHA-256.

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
cp docs/partner-health-model.md partner-managers/docs/partner-health-model.md
cp docs/partner-health-model.md partners/docs/partner-health-model.md
```

- [ ] **Step 6: Verify the copies are byte-identical to canonical**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git diff --no-index docs/partner-health-model.md partner-managers/docs/partner-health-model.md && \
git diff --no-index docs/partner-health-model.md partners/docs/partner-health-model.md && \
echo "COPIES MATCH"
```
Expected: prints `COPIES MATCH` (no diff output).

- [ ] **Step 7: Commit**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add partner-managers/.claude-plugin/plugin.json partners/.claude-plugin/plugin.json \
        partner-managers/.mcp.json partners/.mcp.json \
        partner-managers/docs/partner-health-model.md partners/docs/partner-health-model.md
git commit -m "feat(plugins): scaffold euler-partner-managers + euler-partners skeletons"
```

---

### Task 2: Move the 9 skill folders into the two plugins

**Files:**
- Move: `skills/{generate-qbr,partner-briefing,portfolio-pulse,pending-approvals-triage}/` → `partner-managers/skills/`
- Move: `skills/{my-performance,my-onboarding,my-referrals,my-deals,submit-a-referral}/` → `partners/skills/`
- Delete: empty `skills/` dir

- [ ] **Step 1: `git mv` the 4 manager skills**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git mv skills/generate-qbr            partner-managers/skills/generate-qbr
git mv skills/partner-briefing        partner-managers/skills/partner-briefing
git mv skills/portfolio-pulse         partner-managers/skills/portfolio-pulse
git mv skills/pending-approvals-triage partner-managers/skills/pending-approvals-triage
```

- [ ] **Step 2: `git mv` the 5 partner skills**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git mv skills/my-performance     partners/skills/my-performance
git mv skills/my-onboarding      partners/skills/my-onboarding
git mv skills/my-referrals       partners/skills/my-referrals
git mv skills/my-deals           partners/skills/my-deals
git mv skills/submit-a-referral  partners/skills/submit-a-referral
```

- [ ] **Step 3: Remove the now-empty `skills/` dir and verify the split count**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
rmdir skills 2>/dev/null; ls skills 2>/dev/null && echo "STILL EXISTS" || echo "skills/ removed"
echo "managers:"; ls partner-managers/skills
echo "partners:"; ls partners/skills
```
Expected: `skills/ removed`; managers lists 4 dirs; partners lists 5 dirs.

- [ ] **Step 4: Verify the shared-model links still resolve (no SKILL.md edits needed)**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
test -f partner-managers/skills/generate-qbr/../../docs/partner-health-model.md && echo "generate-qbr link OK"
test -f partner-managers/skills/portfolio-pulse/../../docs/partner-health-model.md && echo "portfolio-pulse link OK"
test -f partners/skills/my-performance/../../docs/partner-health-model.md && echo "my-performance link OK"
```
Expected: all three print `... link OK`.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add -A
git commit -m "refactor(plugins): move 9 skills into euler-partner-managers + euler-partners"
```

---

### Task 3: Rewrite the marketplace and delete root-plugin orphans

**Files:**
- Modify: `.claude-plugin/marketplace.json`
- Delete: `.claude-plugin/plugin.json` (root), `.mcp.json` (root)

- [ ] **Step 1: Overwrite `.claude-plugin/marketplace.json`**

```json
{
  "name": "euler-plugins",
  "owner": {
    "name": "EULER Software Inc.",
    "email": "support@eulerapp.com"
  },
  "metadata": {
    "description": "Marketplace catalog for EULER Software's Claude Code plugins — partner-relationship skills built on the EULER MCP, split by audience: partner managers and partners.",
    "version": "0.18.0"
  },
  "plugins": [
    {
      "name": "euler-partner-managers",
      "source": "./partner-managers",
      "description": "Customer-admin skills for partner-relationship managers: QBR generation, pre-meeting partner briefings, whole-portfolio pulse, and approvals triage. Self-contained HTML output styled with the EULER design system.",
      "version": "0.18.0",
      "author": {
        "name": "EULER Software Inc.",
        "email": "support@eulerapp.com"
      },
      "homepage": "https://eulerapp.com",
      "repository": "https://github.com/Euler-Software-Inc/EULER-skills",
      "license": "MIT",
      "category": "Sales & Partnerships",
      "tags": [
        "partner-management",
        "prm",
        "qbr",
        "quarterly-business-review",
        "partner-briefing",
        "portfolio-pulse",
        "approvals-triage",
        "mcp",
        "euler"
      ],
      "keywords": [
        "euler",
        "partner-management",
        "prm",
        "qbr",
        "partner-briefing",
        "portfolio",
        "approvals",
        "mcp"
      ],
      "strict": false
    },
    {
      "name": "euler-partners",
      "source": "./partners",
      "description": "Self-service skills for partners: performance scorecard, onboarding and certification progress, referral history, deal registrations, and submitting a new referral. Self-contained HTML output styled with the EULER design system.",
      "version": "0.18.0",
      "author": {
        "name": "EULER Software Inc.",
        "email": "support@eulerapp.com"
      },
      "homepage": "https://eulerapp.com",
      "repository": "https://github.com/Euler-Software-Inc/EULER-skills",
      "license": "MIT",
      "category": "Sales & Partnerships",
      "tags": [
        "partner-self-service",
        "performance",
        "onboarding",
        "certification",
        "referrals",
        "deals",
        "mcp",
        "euler"
      ],
      "keywords": [
        "euler",
        "partner-self-service",
        "performance",
        "onboarding",
        "referrals",
        "deals",
        "mcp"
      ],
      "strict": false
    }
  ]
}
```

- [ ] **Step 2: Delete the orphaned root plugin manifest and root MCP file**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git rm .claude-plugin/plugin.json .mcp.json
```

- [ ] **Step 3: Verify marketplace JSON is valid and points at existing sources**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node -e "const m=require('./.claude-plugin/marketplace.json');const fs=require('fs');m.plugins.forEach(p=>{const ok=fs.existsSync('.'+p.source.slice(1)+'/.claude-plugin/plugin.json');console.log(p.name,p.source,ok?'OK':'MISSING plugin.json')})"
```
Expected: both lines end `OK`.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add .claude-plugin/marketplace.json
git commit -m "feat(marketplace): list euler-partner-managers + euler-partners; drop root plugin"
```

---

### Task 4: Add the shared-model drift guard

**Files:**
- Create: `scripts/check-core-sync.mjs`

- [ ] **Step 1: Write `scripts/check-core-sync.mjs`**

```javascript
#!/usr/bin/env node
// Asserts the shared partner-health-model.md is byte-identical across the
// canonical repo-root copy and each plugin's docs/ copy.
// Run before `claude plugin validate .`. Exits 1 on any divergence.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonical = 'docs/partner-health-model.md';
const copies = [
  'partner-managers/docs/partner-health-model.md',
  'partners/docs/partner-health-model.md',
];

const sha = (p) => createHash('sha256').update(readFileSync(join(root, p))).digest('hex');

let ref;
try {
  ref = sha(canonical);
} catch (e) {
  console.error(`FAIL: cannot read canonical ${canonical}: ${e.message}`);
  process.exit(1);
}

const bad = [];
for (const c of copies) {
  let h;
  try {
    h = sha(c);
  } catch (e) {
    bad.push(`${c} (missing: ${e.message})`);
    continue;
  }
  if (h !== ref) bad.push(`${c} (sha ${h.slice(0, 12)} != canonical ${ref.slice(0, 12)})`);
}

if (bad.length) {
  console.error('FAIL: partner-health-model.md copies out of sync with canonical:');
  for (const b of bad) console.error('  - ' + b);
  console.error(`\nCanonical: ${canonical} (sha ${ref.slice(0, 12)})`);
  console.error('Fix: copy the canonical over each diverging file, then re-run.');
  process.exit(1);
}

console.log(`OK: partner-health-model.md in sync across ${copies.length + 1} copies (sha ${ref.slice(0, 12)})`);
```

- [ ] **Step 2: Run it — expect success**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node scripts/check-core-sync.mjs
```
Expected: `OK: partner-health-model.md in sync across 3 copies (sha ...)` and exit code 0.

- [ ] **Step 3: Negative check — verify it fails on drift**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
printf '\n<!-- drift -->\n' >> partners/docs/partner-health-model.md
node scripts/check-core-sync.mjs; echo "exit=$?"
git checkout -- partners/docs/partner-health-model.md
node scripts/check-core-sync.mjs
```
Expected: first run prints `FAIL: ...` with `exit=1`; after `git checkout`, the final run prints `OK` again.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add scripts/check-core-sync.mjs
git commit -m "chore(scripts): add check-core-sync.mjs guard for shared partner-health-model"
```

---

### Task 5: Update README.md and CONTRIBUTING.md

**Files:**
- Modify: `README.md` — "What's included" table, Installation, Repo structure
- Modify: `CONTRIBUTING.md` — skill paths, sync-check note

- [ ] **Step 1: Update `README.md` "What's included"**

Replace the single skill table with two audience-grouped tables. Group the manager skills (`generate-qbr`, `partner-briefing`, `portfolio-pulse`, `pending-approvals-triage`) under a **`euler-partner-managers`** heading and the partner skills (`my-performance`, `my-onboarding`, `my-referrals`, `my-deals`, `submit-a-referral`) under a **`euler-partners`** heading. Update each skill link path to its new home (`./partner-managers/skills/<name>/SKILL.md` or `./partners/skills/<name>/SKILL.md`). Keep the planned-skills rows. Keep the shared-model note but point it at the canonical: ``**Shared model:** `generate-qbr`, `portfolio-pulse` (managers) and `my-performance` (partners) all derive partner-health signals from the same model — canonical at [`docs/partner-health-model.md`](./docs/partner-health-model.md), copied into each plugin's `docs/` and kept in sync by `scripts/check-core-sync.mjs`.``

- [ ] **Step 2: Update `README.md` Installation block**

Replace the "Installation → Via Claude Code" commands with:

````markdown
This repo is a **Claude Code plugin marketplace** (`euler-plugins`) containing two
audience-scoped plugins. Add the marketplace once, then install whichever plugin fits:

```bash
/plugin marketplace add Euler-Software-Inc/EULER-skills

# For partner-relationship managers (customer-admin workflows):
/plugin install euler-partner-managers@euler-plugins

# For partners (self-service workflows):
/plugin install euler-partners@euler-plugins
```

Skills are invoked under each plugin's namespace, e.g.
`/euler-partner-managers:generate-qbr` and `/euler-partners:my-performance`.
````

Also update the "Updating" block to update both plugins:
```bash
/plugin marketplace update euler-plugins
/plugin update euler-partner-managers
/plugin update euler-partners
```

- [ ] **Step 3: Update `README.md` "Repo structure" tree**

Replace the structure code block with the post-split tree (two plugin subtrees, each with `.claude-plugin/plugin.json`, `.mcp.json`, `docs/partner-health-model.md`, `skills/`; root `.claude-plugin/marketplace.json`; root `docs/` canonical; `scripts/check-core-sync.mjs`). Mirror the tree in `docs/specs/2026-06-18-plugin-split-design.md`.

- [ ] **Step 4: Update `CONTRIBUTING.md`**

- In "Adding a new skill" step 1, change the path from `skills/your-skill-name` to `<plugin>/skills/your-skill-name` where `<plugin>` is `partner-managers` or `partners` depending on audience.
- In step 5, the README table is now two tables grouped by plugin.
- Add a short subsection "Shared partner-health model": the canonical lives at `docs/partner-health-model.md`; copies live at `partner-managers/docs/` and `partners/docs/`. After editing the model, copy it into both plugin `docs/` dirs and run `node scripts/check-core-sync.mjs` (must print `OK`) before committing.
- Update the reference-implementation path to `./partner-managers/skills/generate-qbr/SKILL.md`.

- [ ] **Step 5: Verify no stale single-plugin references remain**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
grep -rn "install euler@" README.md showcase/index.html && echo "STALE FOUND" || echo "no stale euler@ install refs"
grep -rn "](./skills/" README.md CONTRIBUTING.md && echo "STALE SKILL PATHS" || echo "no stale skills/ paths in docs"
```
Expected: `no stale euler@ install refs` and `no stale skills/ paths in docs`.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add README.md CONTRIBUTING.md
git commit -m "docs: update README + CONTRIBUTING for the two-plugin split"
```

---

### Task 6: Update the showcase install block

**Files:**
- Modify: `showcase/index.html` (install commands)
- Re-sync: `showcase/showcase-plugin-claude.html` (untracked local copy)

- [ ] **Step 1: Locate the current install command(s) in the showcase**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
grep -n "plugin install euler\|plugin marketplace add\|euler@euler-plugins" showcase/index.html
```
Note the line(s) so the exact surrounding HTML can be matched for replacement.

- [ ] **Step 2: Replace the single install command with two, grouped by audience**

In `showcase/index.html`, the hero/install section currently shows
`/plugin install euler@euler-plugins`. Replace it so it shows the marketplace-add
line plus the two audience-scoped installs:
```
/plugin marketplace add Euler-Software-Inc/EULER-skills
/plugin install euler-partner-managers@euler-plugins   # partner managers
/plugin install euler-partners@euler-plugins            # partners
```
Preserve the existing Copy-button wiring (each command keeps its copy affordance). If the showcase groups skills into sections, label them by plugin. Keep the file self-contained (no JS frameworks, no external assets beyond the existing fonts).

- [ ] **Step 3: Re-sync the untracked local presentation copy**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
cp showcase/index.html showcase/showcase-plugin-claude.html
```

- [ ] **Step 4: Verify the showcase now references both plugins and not the old single install**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
grep -c "euler-partner-managers@euler-plugins\|euler-partners@euler-plugins" showcase/index.html
grep -c "install euler@euler-plugins" showcase/index.html
```
Expected: first count >= 2; second count = 0.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git add showcase/index.html
git commit -m "docs(showcase): two-plugin install block (managers + partners)"
```

---

### Task 7: Final gate, validate, and PR dev -> main

**Files:** none (verification + PR)

- [ ] **Step 1: Run the full local gate**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
node scripts/check-core-sync.mjs
claude plugin validate .
```
Expected: sync check prints `OK`; `claude plugin validate .` reports both plugins valid with no errors.

- [ ] **Step 2: Structural assertions**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
echo "manager skills:"; ls partner-managers/skills | wc -l   # expect 4
echo "partner skills:"; ls partners/skills | wc -l           # expect 5
test ! -e .mcp.json && echo "root .mcp.json gone"
test ! -e .claude-plugin/plugin.json && echo "root plugin.json gone"
grep -rIl "description:.*<" partner-managers/skills partners/skills && echo "ANGLE BRACKET IN DESCRIPTION" || echo "no angle brackets in skill descriptions"
```
Expected: `4`, `5`, `root .mcp.json gone`, `root plugin.json gone`, `no angle brackets in skill descriptions`.

- [ ] **Step 3: Confirm working tree is clean and review the branch diff**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git status --short
git log --oneline origin/main..dev
```
Expected: clean tree (only the untracked `showcase/showcase-plugin-claude.html`); the log shows the split commits.

- [ ] **Step 4: Switch gh to the Euler account, push, open + merge the PR**

```bash
gh auth switch --user kennedyeuler && gh auth setup-git
cd C:/Users/Kenny/www/euler/EULER-skills
git push origin dev
gh pr create --base main --head dev --title "feat: split into euler-partner-managers + euler-partners (v0.18.0)" --body-file docs/specs/2026-06-18-plugin-split-design.md
gh pr merge dev --merge --delete-branch=false
```
Expected: PR created and merged into `main`. (Use `--body-file`, never an inline `--body` with quotes — PowerShell word-splits embedded double-quotes.)

- [ ] **Step 5: Post-merge sanity (optional, on main)**

```bash
cd C:/Users/Kenny/www/euler/EULER-skills
git checkout main && git pull && claude plugin validate . && git checkout dev
```
Expected: `claude plugin validate .` passes on `main`.

---

## Notes for the executor

- **Never Read+Write to copy `partner-health-model.md`** — use `cp` so bytes match the check.
- **No SKILL.md edits** — the `../../docs/...` model links resolve to each plugin's own `docs/` after the move. If a grep suggests otherwise, stop and re-check before editing.
- **No angle brackets** in any `plugin.json`/`marketplace.json`/SKILL.md `description` (silent-load-failure rule).
- **gh reverts to `kennedysmartins`** — always `gh auth switch --user kennedyeuler` before push/PR.
- Branch is `dev`; one PR to `main` at the end.
