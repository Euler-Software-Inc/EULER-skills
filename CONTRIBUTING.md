# Contributing to EULER Skills

Thanks for adding a skill or improving an existing one. This repo is small
and opinionated — read this before opening a PR.

## Quality gate

Before every push, the quality gate must pass:

```bash
node scripts/quality-gate.mjs
```

Enforced two ways:

- **Locally** — a pre-push hook runs it automatically and blocks the push on
  failure. Activate once per clone: `git config core.hooksPath .githooks`.
- **CI** — `.github/workflows/quality-gate.yml` re-runs it on every PR to `main`
  (and pushes to `dev`).

It checks (errors block; warnings are surfaced): valid plugin manifests
(`claude plugin validate`), canonical assets in sync (`check-core-sync`), skill
frontmatter (`name` matches the folder, kebab-case, **no angle brackets in
`description`**), no legacy CSS tokens, English-only shipped content, no real
Bubble IDs or secrets, lightweight skill HTML (no JS / images / base64), one
example per skill, and no internal dev docs tracked. Fix every error before you push.

## Adding a new skill

1. **Copy the template:**
   ```bash
   # <plugin> is partner-managers (customer-admin) or partners (self-service)
   mkdir -p <plugin>/skills/your-skill-name && cp template/SKILL.md <plugin>/skills/your-skill-name/SKILL.md
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

   When a skill's SKILL.md approaches 500 lines, extract long reference
   material (response field tables, exhaustive enum lists, examples) to
   `references/<topic>.md`. SKILL.md stays focused on orchestration +
   output + rules; references are loaded on demand. This matches the
   Anthropic Agent Skills progressive-disclosure pattern.

   Save raw runs to `<plugin>/skills/<your-skill-name>/.scratch/` while iterating;
   keep the directory in `.gitignore` (or delete before merge). Commit a
   sanitized golden output to `<plugin>/skills/<your-skill-name>/examples/` once
   the skill stabilizes.

4. **Anti-hallucination rules are not boilerplate.** Tailor them to the
   data shapes your skill consumes. Specifically call out:
   - Currency / number normalization quirks
   - Date vs duration vs string distinctions
   - Period-filtered vs all-time data sources
   - Malformed JSON shapes that need loose parsing

5. **Update `README.md`'s skill table** — under the right plugin heading
   (`euler-partner-managers` or `euler-partners`), move your skill from
   🚧 Planned to ✅ Available with the validation date.

6. **Bump the version** per the policy in the README. The marketplace
   (`.claude-plugin/marketplace.json`) and both plugin manifests
   (`partner-managers/.claude-plugin/plugin.json`,
   `partners/.claude-plugin/plugin.json`) share one version line — bump them
   together.

## Shared partner-health model

`generate-qbr` and `portfolio-pulse` (in `euler-partner-managers`) and
`my-performance` (in `euler-partners`) all read the same partner-health model.
Because plugins ship independently, the model is duplicated per plugin:

- **Canonical:** `docs/partner-health-model.md` — edit here.
- **Copies:** `partner-managers/docs/partner-health-model.md`,
  `partners/docs/partner-health-model.md`.

After editing the canonical, **copy** it over both plugin copies (use `cp` so the
content matches exactly — don't hand-edit each) and run the sync check:

```bash
cp docs/partner-health-model.md partner-managers/docs/partner-health-model.md
cp docs/partner-health-model.md partners/docs/partner-health-model.md
node scripts/check-core-sync.mjs   # must print OK before you commit
```

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
- **HTML output must be lightweight + mobile-responsive (always).** Generated
  HTML has to open fast on any device: no JavaScript, no images (the brand is a
  text wordmark, not an `<img>`), no base64/data-URI blobs, at most the two Euler web fonts loaded
  with `display=swap` (+ `<link rel="preconnect">`) so text paints instantly.
  Use fluid `clamp()` type and make wide tables scroll on narrow screens — never
  fixed pixel widths that overflow a phone. Cap repeated rows (top-N) so the
  document stays small. Test the output at a 360px viewport before merging.

## Things to NOT do

- **Do not invent MCP tools or params.** If the catalog doesn't have it,
  the skill can't use it. Open an issue on `euler-mcp` instead.
- **Do not put angle brackets in a skill's `description`.** `<like-this>` is
  parsed as an HTML tag and the skill silently fails to load (it won't appear in
  the plugin's skill list). Use plain words in the description.
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
- Work on `dev` and open a PR to `main`. The quality gate must pass — the
  pre-push hook and CI enforce it.

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
