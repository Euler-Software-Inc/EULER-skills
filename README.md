# EULER Skills

> Claude Code plugins — skills, slash commands, and sub-agents that orchestrate
> the [EULER MCP](https://mcp.eulerapp.com) tools for partner-relationship
> workflows.

This repo is a **Claude Code plugin marketplace** (`euler-plugins`) containing two
audience-scoped plugins:

- **`euler-for-partner-managers`** — "EULER for Partner managers": customer-admin workflows.
- **`euler-for-partners`** — "EULER for Partners": partner self-service workflows.

## What's included

### `euler-for-partner-managers` — for partner-relationship managers (customer-admin)

| Skill | Status | Description |
|-------|--------|-------------|
| [`generate-qbr`](./partner-managers/skills/generate-qbr/SKILL.md) | ✅ Available *(validated against staging 2026-05-25)* | Generate a Quarterly Business Review for a specific partner |
| [`partner-briefing`](./partner-managers/skills/partner-briefing/SKILL.md) | ✅ Available *(validated against staging 2026-05-25)* | Pre-meeting briefing for a partner call — 30-second read with what they'll discuss + what you should bring up |
| [`portfolio-pulse`](./partner-managers/skills/portfolio-pulse/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | One-screen pulse of the whole partner portfolio — totals, top performers, who needs attention, coverage gaps |
| [`pending-approvals-triage`](./partner-managers/skills/pending-approvals-triage/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | Age-sorted worklist of what's awaiting approval — partner apps, pending referrals, pending deal registrations |
| `partner-health-check` | 🚧 Planned | One-glance health snapshot of a partner (deals + referrals + agreement + commission status) |
| `monthly-commission-report` | 🚧 Planned | Auto-generate commission payout report for a partner or company-wide |
| `flow-onboarding-setup` | 🚧 Planned | Scaffold a new onboarding flow with steps + assignments |

### `euler-for-partners` — for partners (self-service)

| Skill | Status | Description |
|-------|--------|-------------|
| [`my-performance`](./partners/skills/my-performance/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | A partner views their own performance scorecard with one customer — health score (0–100), headline stats (revenue, deals, commissions, referrals), and the single biggest lever to improve |
| [`my-onboarding`](./partners/skills/my-onboarding/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | A partner views their own onboarding and certification progress across all assigned flows — what's done, what's left, what's overdue |
| [`my-referrals`](./partners/skills/my-referrals/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | A partner views their full referral history with one customer — pipeline snapshot (active, won, lost counts + total pipeline value), per-referral status cards sorted by recency, and next-action nudges |
| [`my-deals`](./partners/skills/my-deals/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | A partner views all deal registrations they have submitted with one customer — status breakdown (approved, pending, rejected), per-deal cards with value and stage, and total attributed pipeline |
| [`submit-a-referral`](./partners/skills/submit-a-referral/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* — **write action** | A partner submits a new referral to a customer — collects company name, contact, and opportunity details interactively, then calls the EULER MCP to create the referral record |
| `referral-workflow` | 🚧 Planned | End-to-end referral submission flow (list accounts → get form → submit) |

**Shared model:** `generate-qbr`, `portfolio-pulse` (managers) and `my-performance`
(partners) all derive partner-health signals from the same model — canonical at
[`docs/partner-health-model.md`](./docs/partner-health-model.md), copied into each
plugin's `docs/` and kept in sync by
[`scripts/check-core-sync.mjs`](./scripts/check-core-sync.mjs).

## Installation

Add the marketplace once, then install whichever plugin fits your role.

### Via Claude Code (recommended)

```bash
/plugin marketplace add Euler-Software-Inc/EULER-skills

# For partner-relationship managers (customer-admin workflows):
/plugin install euler-for-partner-managers@euler-plugins

# For partners (self-service workflows):
/plugin install euler-for-partners@euler-plugins
```

The first time you invoke an EULER skill, Claude will trigger the OAuth flow
against `https://mcp.eulerapp.com` — one-time consent, the token is cached for
30 days. Skills are invoked under each plugin's namespace, e.g.
`/euler-for-partner-managers:generate-qbr` and `/euler-for-partners:my-performance`.

### Local development install

To iterate on the plugins locally without publishing:

```bash
git clone https://github.com/Euler-Software-Inc/EULER-skills.git
cd EULER-skills
claude --plugin-dir .
```

Use `/reload-plugins` inside Claude Code to pick up changes without restarting.

### Updating

```bash
/plugin marketplace update euler-plugins
/plugin update euler-for-partner-managers
/plugin update euler-for-partners
```

### Validation

To validate before pushing changes:

```bash
node scripts/check-core-sync.mjs   # shared partner-health-model copies in sync
claude plugin validate .           # both plugins resolve and load
```

## How it works

These plugins do NOT ship their own MCP server. They reference the existing remote
EULER MCP via each plugin's `.mcp.json`. When a user invokes a skill, Claude:

1. Reads the skill's playbook (`SKILL.md`)
2. Connects to `https://mcp.eulerapp.com` (OAuth 2.1, one-time consent)
3. Orchestrates the MCP tools per the skill's instructions
4. Formats the output as the skill prescribes

The connector and the plugins work together:

- **Connector** = raw tool access (anyone with Claude.ai can use it)
- **Plugins** = curated workflows on top (skills, slash commands, sub-agents) that
  bundle expertise into one-click invocations

## Repo structure

```
EULER-skills/
├── .claude-plugin/
│   └── marketplace.json              Marketplace catalog (lists both plugins)
├── partner-managers/                 Plugin: EULER for Partner managers
│   ├── .claude-plugin/plugin.json    Plugin manifest (name, version, metadata)
│   ├── .mcp.json                     References the remote EULER MCP server
│   ├── docs/partner-health-model.md  Synced copy of the canonical health model
│   └── skills/                       generate-qbr · partner-briefing · portfolio-pulse · pending-approvals-triage
├── partners/                         Plugin: EULER for Partners
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json                     References the remote EULER MCP server
│   ├── docs/partner-health-model.md  Synced copy of the canonical health model
│   └── skills/                       my-performance · my-onboarding · my-referrals · my-deals · submit-a-referral
├── docs/
│   ├── partner-health-model.md       CANONICAL shared partner-health model
│   ├── plans/                        Implementation plans (superpowers)
│   └── specs/                        Design specs (superpowers)
├── scripts/
│   └── check-core-sync.mjs           Guards the model copies against drift
├── template/                         Starter SKILL.md for new skills (not loaded — outside any plugin)
├── showcase/                         Self-contained HTML showcase
├── CONTRIBUTING.md                   How to add or modify a skill
└── README.md
```

Each skill folder contains `SKILL.md` plus `assets/` (styles.css + template.html),
`references/` (MCP field paths, account-gate notes), and `examples/` (sanitized
worked outputs).

## Adding a new skill

Copy [`template/SKILL.md`](./template/SKILL.md) into a new
`<plugin>/skills/<your-skill-name>/SKILL.md`, where `<plugin>` is `partner-managers`
(customer-admin) or `partners` (self-service). Every new skill must include:

- YAML frontmatter with `name` (matching folder name) and `description`
  (**never use angle brackets in the `description` — they are parsed as HTML and
  the skill silently fails to load**)
- Sections: When to use · Inputs · Orchestration sequence · Output format
  · Anti-hallucination rules · Example user flow · Why this skill exists
- A worked example committed under `examples/`
- Validation against the live MCP before merging

Full guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Reference implementation:
[`partner-managers/skills/generate-qbr/`](./partner-managers/skills/generate-qbr/SKILL.md).

## Versioning

Semantic versioning. The marketplace and both plugins share one version line and
bump together:

- **Patch** (0.18.x) — skill text refinements, anti-hallucination tightening,
  output format tweaks
- **Minor** (0.x.0) — new skills added, new tools referenced from MCP
- **Major** (x.0.0) — breaking changes to existing skill output formats or trigger
  phrases (rare; we mostly add, rarely remove)

## License

MIT — see [LICENSE](./LICENSE).

## Companion repo

These plugins pair with the [EULER MCP server](https://github.com/Euler-Software-Inc/euler-mcp)
that exposes the underlying tools.
