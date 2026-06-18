# EULER-skills plugin split — design spec

> Date: 2026-06-18 · repo `Euler-Software-Inc/EULER-skills` · branch `dev` @ `143cdfd`
> Process: superpowers:brainstorming → writing-plans

**Goal:** Split the single `euler` plugin into two audience-scoped plugins in one
marketplace repo — `euler-partner-managers` (4 customer-admin skills) and
`euler-partners` (5 partner self-service skills) — with **no skill-content changes**
and **zero broken references**.

**Architecture:** One marketplace (`euler-plugins`) listing two plugins. Each plugin
is a self-contained source subtree (`partner-managers/`, `partners/`) with its own
`.claude-plugin/plugin.json`, `.mcp.json`, `docs/`, and `skills/`. The one cross-cutting
shared doc (`partner-health-model.md`) is copied into each plugin's `docs/`, which
preserves the existing `../../docs/...` relative links so **no SKILL.md changes are
needed**. Repo-root `docs/partner-health-model.md` stays canonical; a pure-Node check
asserts the copies stay byte-identical.

**Tech:** Claude Code plugin marketplace manifests (JSON); Markdown skills; one
dependency-free Node check script. No build system, no runtime deps.

---

## Current state (verified 2026-06-18 @ `143cdfd`)

- One plugin `euler`, marketplace `euler-plugins`, **v0.17.0**, source `./`.
- 9 skills under `skills/<name>/`, each self-contained:
  `SKILL.md` + `assets/{styles.css, template.html}` + `references/{…}` + `examples/`.
- **Per-skill assets are NOT byte-identical across skills.** `styles.css`,
  `template.html`, and `mcp-field-paths.md` each have 9 distinct hashes;
  `account-gate.md` exists in 7/9 skills. They are self-contained — they move with
  their skill, no special handling.
- **The only cross-skill, cross-plugin shared file is `docs/partner-health-model.md`**,
  linked via `../../docs/partner-health-model.md` from:
  - `generate-qbr` (SKILL.md:159, :259) → managers
  - `portfolio-pulse` (SKILL.md:101) → managers
  - `my-performance` (SKILL.md:98, :217) → partners
- Root `.mcp.json` references the remote `euler` MCP (`https://mcp.eulerapp.com/mcp`,
  `type: http`). Root `.claude-plugin/plugin.json` is the single plugin manifest.

## Decisions (locked)

| Decision | Value |
|---|---|
| Manager-plugin slug | `euler-partner-managers` — display "EULER for Partner managers" |
| Partner-plugin slug | `euler-partners` — display "EULER for Partners" |
| Fate of `euler` | **Replace entirely** (remove; marketplace lists only the two) |
| Shared-model handling | **Approach A** — per-plugin `docs/` copy; canonical at repo root; links unchanged |
| Version | marketplace + both plugins → **0.18.0** |
| Drift guard | `scripts/check-core-sync.mjs` — included |
| Branch flow | work on `dev` → PR `dev`→`main` |

## Target structure

```
EULER-skills/
├── .claude-plugin/
│   └── marketplace.json              # lists 2 plugins (NO root plugin.json)
├── partner-managers/
│   ├── .claude-plugin/plugin.json    # name: euler-partner-managers
│   ├── .mcp.json                     # euler remote MCP (copy of current root)
│   ├── docs/partner-health-model.md  # synced copy
│   └── skills/
│       ├── generate-qbr/
│       ├── partner-briefing/
│       ├── portfolio-pulse/
│       └── pending-approvals-triage/
├── partners/
│   ├── .claude-plugin/plugin.json    # name: euler-partners
│   ├── .mcp.json                     # euler remote MCP (copy)
│   ├── docs/partner-health-model.md  # synced copy
│   └── skills/
│       ├── my-performance/
│       ├── my-onboarding/
│       ├── my-referrals/
│       ├── my-deals/
│       └── submit-a-referral/
├── docs/
│   ├── partner-health-model.md       # CANONICAL (unchanged location)
│   ├── plans/                        # dev history (unchanged)
│   └── specs/                        # dev history (this spec lives here)
├── scripts/
│   └── check-core-sync.mjs           # NEW — asserts the 3 model copies are identical
├── template/                         # starter SKILL.md (repo-level, unchanged)
├── showcase/                         # index.html install block updated
├── README.md                         # rewritten for 2 plugins
├── CONTRIBUTING.md                   # skill paths + sync-check
└── (DELETE: root .claude-plugin/plugin.json, root .mcp.json)
```

## Components / changes

### 1. Skill moves (`git mv`, history preserved)
- `skills/generate-qbr` → `partner-managers/skills/generate-qbr`
- `skills/partner-briefing` → `partner-managers/skills/partner-briefing`
- `skills/portfolio-pulse` → `partner-managers/skills/portfolio-pulse`
- `skills/pending-approvals-triage` → `partner-managers/skills/pending-approvals-triage`
- `skills/my-performance` → `partners/skills/my-performance`
- `skills/my-onboarding` → `partners/skills/my-onboarding`
- `skills/my-referrals` → `partners/skills/my-referrals`
- `skills/my-deals` → `partners/skills/my-deals`
- `skills/submit-a-referral` → `partners/skills/submit-a-referral`

Each skill's `assets/`, `references/`, `examples/` move with it untouched. After
moves, the old `skills/` dir is removed.

### 2. Plugin manifests (`<plugin>/.claude-plugin/plugin.json`)
Mirror the current manifest shape. Fields: `$schema`, `name` (slug), `displayName`,
`version` `0.18.0`, `description` (audience-specific, **no angle brackets**),
`author` (EULER Software Inc. / support@eulerapp.com / https://eulerapp.com),
`homepage`, `repository` (string), `license` MIT, `keywords` (audience-scoped subset).

### 3. `.mcp.json` (per plugin)
Byte-identical to the current root `.mcp.json` (single `euler` http server at
`https://mcp.eulerapp.com/mcp`). Both plugins get one.

### 4. Shared model doc
- Canonical: `docs/partner-health-model.md` (unchanged).
- Copies: `partner-managers/docs/partner-health-model.md`, `partners/docs/partner-health-model.md`.
- `../../docs/partner-health-model.md` in each SKILL.md resolves to its own plugin's
  `docs/` → **no SKILL.md edits**.

### 5. `marketplace.json`
Rewrite `plugins[]` to two entries (sources `./partner-managers`, `./partners`), each
with audience-specific `description`/`tags`/`keywords`, `version` `0.18.0`, `author`,
`homepage`, `repository` (string), `license`, `category` "Sales & Partnerships",
`strict: false`. Bump `metadata.version` → `0.18.0`.

### 6. Deletions
- `./.claude-plugin/plugin.json` (orphaned — no root plugin anymore).
- `./.mcp.json` (each plugin now carries its own).

### 7. `scripts/check-core-sync.mjs`
Pure Node, no deps. SHA-256 the canonical `docs/partner-health-model.md` and the two
plugin copies; print `OK` with the hash, or list diverging paths and `process.exit(1)`.
Runs before `claude plugin validate .` in the pre-PR gate.

### 8. Docs
- **README.md** — rewrite "What's included" (group skills by plugin), Installation
  (two `/plugin install` commands), Repo structure (new tree); keep the shared-model
  note pointing at the canonical doc.
- **CONTRIBUTING.md** — skill paths now `<plugin>/skills/<name>`; document that
  `partner-health-model.md` is duplicated per plugin and `check-core-sync.mjs` guards it.
- **showcase/index.html** — install block becomes two commands grouped by audience;
  re-sync the untracked `showcase/showcase-plugin-claude.html` local copy afterward.

## Validation / success criteria

- `node scripts/check-core-sync.mjs` exits 0 (three model copies identical).
- `claude plugin validate .` passes — marketplace + both plugins resolve, each has a
  valid `plugin.json` and discoverable skills.
- All 9 skills load under their new namespaces
  (`/euler-partner-managers:*`, `/euler-partners:*`); `../../docs/partner-health-model.md`
  resolves in all three linking skills.
- No `<…>` angle brackets in any plugin/marketplace description (silent-load-failure rule).
- Lands on `dev`; single PR `dev`→`main`.

## Out of scope (YAGNI)

- No `styles.css` extraction/refactor — per-skill CSS stays exactly as today (the split
  does not worsen it).
- No skill logic / content / trigger-phrase changes.
- No CI workflow — the gate stays local/manual.
- No `euler-mcp` changes.
