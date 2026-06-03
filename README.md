# EULER Skills

> Claude Code plugin — skills, slash commands, and sub-agents that orchestrate
> the [EULER MCP](https://mcp.eulerapp.com) tools for partner-relationship
> workflows.

## What's included

| Skill | Status | Description |
|-------|--------|-------------|
| [`generate-qbr`](./skills/generate-qbr/SKILL.md) | ✅ Available *(validated against staging 2026-05-25)* | Generate a Quarterly Business Review for a specific partner |
| [`partner-briefing`](./skills/partner-briefing/SKILL.md) | ✅ Available *(validated against staging 2026-05-25)* | Pre-meeting briefing for a partner call — 30-second read with what they'll discuss + what you should bring up |
| [`portfolio-pulse`](./skills/portfolio-pulse/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | One-screen pulse of the whole partner portfolio — totals, top performers, who needs attention, coverage gaps |
| [`pending-approvals-triage`](./skills/pending-approvals-triage/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | Age-sorted worklist of what's awaiting approval — partner apps, pending referrals, pending deal registrations |
| [`my-onboarding`](./skills/my-onboarding/SKILL.md) | 🆕 New *(field paths pending live-MCP validation)* | Partner-facing: a partner views their own onboarding and certification progress across all assigned flows — what's done, what's left, what's overdue (contrast: customer-admin skills like `portfolio-pulse` / `generate-qbr`) |
| `partner-health-check` | 🚧 Planned | One-glance health snapshot of a partner (deals + referrals + agreement + commission status) |
| `monthly-commission-report` | 🚧 Planned | Auto-generate commission payout report for a partner or company-wide |
| `referral-workflow` | 🚧 Planned | End-to-end referral submission flow (list accounts → get form → submit) |
| `flow-onboarding-setup` | 🚧 Planned | Scaffold a new onboarding flow with steps + assignments |

**Shared model:** `generate-qbr` and `portfolio-pulse` both derive partner-health signals from the same model — see [`docs/partner-health-model.md`](./docs/partner-health-model.md).

## Installation

This repo is structured as a **Claude Code plugin marketplace** (`euler-plugins`)
containing one plugin (`euler`).

### Via Claude Code (recommended)

```bash
/plugin marketplace add Euler-Software-Inc/EULER-skills
/plugin install euler@euler-plugins
```

The first time you invoke an EULER skill, Claude will trigger the OAuth flow
against `https://mcp.eulerapp.com` — one-time consent, the token is cached for
30 days. Skills are invoked as `/euler:generate-qbr` and `/euler:partner-briefing`.

### Local development install

To iterate on the plugin locally without publishing:

```bash
git clone https://github.com/Euler-Software-Inc/EULER-skills.git
cd EULER-skills
claude --plugin-dir .
```

Or load it without cloning via `--plugin-dir` pointing at a local path. Use
`/reload-plugins` inside Claude Code to pick up changes without restarting.

### Updating

```bash
/plugin marketplace update euler-plugins
/plugin update euler
```

### Validation

To validate the manifests before pushing changes:

```bash
claude plugin validate .
```

## How it works

This plugin does NOT ship its own MCP server. It references the existing remote
EULER MCP via `.mcp.json`. When a user invokes a skill, Claude:

1. Reads the skill's playbook (`SKILL.md`)
2. Connects to `https://mcp.eulerapp.com` (OAuth 2.1, one-time consent)
3. Orchestrates the MCP tools per the skill's instructions
4. Formats the output as the skill prescribes

The connector and the plugin work together:

- **Connector** = raw tool access (anyone with Claude.ai can use it)
- **Plugin** = curated workflows on top (skills, slash commands, sub-agents) that bundle expertise into one-click invocations

## Repo structure

```
EULER-skills/
├── .claude-plugin/
│   ├── marketplace.json     Marketplace catalog (lists the euler plugin)
│   └── plugin.json          Plugin manifest (name, version, metadata)
├── .mcp.json                References the remote EULER MCP server
├── skills/                  Model-invoked skills — the primary content
│   ├── generate-qbr/
│   │   ├── SKILL.md         The QBR generation playbook
│   │   ├── references/      Reference docs (MCP field paths) — shared
│   │   ├── assets/          styles.css + template.html for HTML output
│   │   └── examples/        Sanitized example outputs (HTML + .md)
│   └── partner-briefing/
│       ├── SKILL.md         Pre-meeting briefing playbook
│       ├── assets/          styles.css + template.html for HTML output
│       └── examples/        Sanitized example outputs (HTML + .md)
├── template/                Starter SKILL.md for new skills (not loaded — outside skills/)
├── commands/                (Future) Explicit slash commands like /euler:list
├── agents/                  (Future) Sub-agents for multi-step workflows
├── CONTRIBUTING.md          How to add or modify a skill
└── README.md
```

## Adding a new skill

Copy [`template/SKILL.md`](./template/SKILL.md) into a new `skills/<your-skill-name>/SKILL.md`. Every
new skill must include:

- YAML frontmatter with `name` (matching folder name) and `description`
- Sections: When to use · Inputs · Orchestration sequence · Output format
  · Anti-hallucination rules · Example user flow · Why this skill exists
- A worked example committed under `examples/`
- Validation against the live MCP before merging

Full guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Reference implementation: [`skills/generate-qbr/`](./skills/generate-qbr/SKILL.md).

## Versioning

Semantic versioning. Plugin version bumps when:

- **Patch** (0.1.x → 0.1.y) — skill text refinements, anti-hallucination
  tightening, output format tweaks
- **Minor** (0.x.0 → 0.y.0) — new skills added, new tools referenced from MCP
- **Major** (x.0.0 → y.0.0) — breaking changes to existing skill output formats
  or trigger phrases (rare; we mostly add, rarely remove)

## License

MIT — see [LICENSE](./LICENSE).

## Companion repo

This plugin pairs with the [EULER MCP server](https://github.com/Euler-Software-Inc/euler-mcp)
that exposes the underlying 23 tools.
