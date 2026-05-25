# EULER Skills

> Claude Code plugin — skills, slash commands, and sub-agents that orchestrate
> the [EULER MCP](https://mcp.eulerapp.com) tools for partner-relationship
> workflows.

## What's included

| Skill | Status | Description |
|-------|--------|-------------|
| [`generate-qbr`](./skills/generate-qbr/SKILL.md) | ✅ Available *(validated against staging 2026-05-25)* | Generate a Quarterly Business Review for a specific partner |
| [`partner-briefing`](./skills/partner-briefing/SKILL.md) | ✅ Available *(validated against staging 2026-05-25)* | Pre-meeting briefing for a partner call — 30-second read with what they'll discuss + what you should bring up |
| `partner-health-check` | 🚧 Planned | One-glance health snapshot of a partner (deals + referrals + agreement + commission status) |
| `monthly-commission-report` | 🚧 Planned | Auto-generate commission payout report for a partner or company-wide |
| `referral-workflow` | 🚧 Planned | End-to-end referral submission flow (list accounts → get form → submit) |
| `pending-approvals-triage` | 🚧 Planned | Prioritize pending partner approvals by signal strength |
| `flow-onboarding-setup` | 🚧 Planned | Scaffold a new onboarding flow with steps + assignments |

## Installation

### Via Claude marketplace (once published)

```bash
/plugin install @euler-software-inc/euler
```

### Via Claude Code, manual install (development)

```bash
git clone https://github.com/Euler-Software-Inc/EULER-skills.git ~/.claude/plugins/euler
```

Then restart Claude Code. The first time you invoke an EULER skill, Claude will
trigger the OAuth flow against `https://mcp.eulerapp.com` — one-time consent,
the token is cached for 30 days.

### Via Claude.ai web / Cowork

(Once the plugin is approved on `claude.com/plugins`) — search for "EULER" in
the plugin marketplace and click Install. Cowork org admins can push it to all
workspace members automatically.

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
│   └── plugin.json          Plugin manifest (name, version, metadata)
├── .mcp.json                References the remote EULER MCP server
├── skills/                  Model-invoked skills — the primary content
│   ├── _template/           Starter SKILL.md for new contributions
│   ├── generate-qbr/
│   │   ├── SKILL.md         The QBR generation playbook
│   │   ├── references/      Reference docs (MCP field paths) — shared
│   │   ├── assets/          styles.css + template.html for HTML output
│   │   └── examples/        Sanitized example outputs (HTML + .md)
│   └── partner-briefing/
│       ├── SKILL.md         Pre-meeting briefing playbook
│       ├── assets/          styles.css + template.html for HTML output
│       └── examples/        Sanitized example outputs (HTML + .md)
├── commands/                (Future) Explicit slash commands like /euler:list
├── agents/                  (Future) Sub-agents for multi-step workflows
├── CONTRIBUTING.md          How to add or modify a skill
└── README.md
```

## Adding a new skill

Copy [`skills/_template/`](./skills/_template/SKILL.md) and rename. Every
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
that exposes the underlying 21 tools.
