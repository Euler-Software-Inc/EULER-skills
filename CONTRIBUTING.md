# Contributing to EULER Skills

Thanks for adding a skill or improving an existing one. This repo is small
and opinionated — read this before opening a PR.

## Adding a new skill

1. **Copy the template:**
   ```bash
   cp -r skills/_template skills/<your-skill-name>
   ```
   The folder name must be `kebab-case` and must match the `name:` field
   in `SKILL.md` frontmatter exactly.

2. **Fill in every `<placeholder>` in the copied `SKILL.md`.** Required
   sections (in order):
   - YAML frontmatter (`name`, `description`)
   - When to use this skill
   - Inputs needed from user
   - Orchestration sequence (with the tool/field-path tables)
   - Output format
   - Anti-hallucination rules
   - Example user flow
   - Why this skill exists

3. **Validate against the live MCP before merging.** Every tool call,
   every action name, every field path you reference must be verified
   against the actual MCP response — not from memory, not from docs.
   The catalog and response shapes drift; only the live server is truth.

   Save raw runs to `skills/<your-skill-name>/.scratch/` while iterating;
   keep the directory in `.gitignore` (or delete before merge). Commit a
   sanitized golden output to `skills/<your-skill-name>/examples/` once
   the skill stabilizes.

4. **Anti-hallucination rules are not boilerplate.** Tailor them to the
   data shapes your skill consumes. Specifically call out:
   - Currency / number normalization quirks
   - Date vs duration vs string distinctions
   - Period-filtered vs all-time data sources
   - Malformed JSON shapes that need loose parsing

5. **Update `README.md`'s skill table** — move your skill from 🚧 Planned
   to ✅ Available with the validation date.

6. **Bump `.claude-plugin/plugin.json` version** per the policy in the
   README (patch / minor / major).

## Style guide

- **Tool references** — always use the public MCP tool name
  (`list_accounts`, `partner_artifacts`). Never reference internal
  Bubble workflow names. The MCP abstracts Bubble; skills stay abstracted.
- **Trigger phrases** — include 3–5 natural-language variants in the
  "When to use this skill" section. These are the user's invocation
  contract; don't change them lightly.
- **Output format** — use a code block (` ```markdown ... ``` `) so the
  template is unambiguous. Show placeholders as `<field.path>` keyed to
  the field-path tables above.
- **Examples** — every skill must have at least one worked example in
  `examples/`. Sanitize real customer data (rename partners, round
  dollar amounts).

## Things to NOT do

- **Do not invent MCP tools or params.** If the catalog doesn't have it,
  the skill can't use it. Open an issue on `euler-mcp` instead.
- **Do not couple skills to Bubble workflow names.**
- **Do not relax anti-hallucination rules.** Tighten (add more), never
  loosen.
- **Do not commit real customer data** to `examples/`. Sanitize names,
  IDs, and dollar amounts.
- **Do not ship to `main` without validating against staging at least
  once.** "It compiles" is not validation — the skill must have run
  end-to-end with real data.
- **Do not change trigger phrases of an existing skill without bumping
  the major version.** Those are user contracts.

## PR conventions

- Title: `feat(<skill-name>): <one-line summary>` or
  `fix(<skill-name>): <one-line summary>` or
  `docs: <one-line summary>`.
- Body should describe:
  - What changed in the skill
  - How it was validated (which partners / quarters / scenarios tested)
  - Any new anti-hallucination rules and why they were added
- For in-progress / WIP work, push directly to `main` is fine — this is
  a small repo with few contributors. PRs are for external contributors
  or risky changes.

## Sub-agents

If a skill grows complex enough to warrant a specialized sub-agent (e.g.
a narrative writer that consumes orchestration output), put the agent
spec under `agents/<agent-name>.md` and have the skill invoke it by name
in its orchestration sequence. This pattern is not yet covered by
Anthropic's official spec — keep the boundary clean so we can swap
patterns later.

## Questions?

Open an issue on the repo. For MCP catalog questions, cross-post to
[`euler-mcp`](https://github.com/Euler-Software-Inc/euler-mcp).
