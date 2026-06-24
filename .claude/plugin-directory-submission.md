# Plugin Directory submission — answers (2 plugins)

The directory form is **per-plugin** → submit twice. Same repo for both; the plugin **name** distinguishes them. All public-facing values in English.

---

## Submission 1 — EULER for Partner Managers

**Plugin information**
- **Link to plugin** (repo URL): `https://github.com/Euler-Software-Inc/EULER-skills`
- **Plugin homepage**: `https://euler-software-inc.github.io/EULER-skills/` *(see “Docs / homepage” below — or leave blank, it’s optional)*
- **Plugin name**: `EULER for Partner Managers`
- **Plugin description**:
  > Claude skills for partner-relationship managers that orchestrate the EULER partner-management platform (via the EULER MCP). Generate a Quarterly Business Review for a specific partner, a 30-second pre-call briefing, a whole-portfolio pulse (top performers, who needs attention, coverage gaps), and an age-sorted approvals-triage worklist. Every skill returns a single self-contained HTML report styled with the EULER design system — open it in a browser, print to PDF, or share the file.
- **Example use cases**:
  ```
  Generate a Q2 2026 QBR for partner Accenture.
  Prep me for my call with Lumon — what should I know from the last 30 days?
  How is my whole partner portfolio doing? Show top performers and who needs attention.
  What is in my approval queue? Show the oldest / most overdue items first.
  ```

**Submission details**
- **Supported platforms**: ☑ Claude Code *(built + tested here)*. ☑ Claude Cowork only if you’ve tested it there first (the skills are surface-agnostic, so it likely works — but verify before checking it).
- **License type**: `MIT`
- **Privacy policy URL**: Euler’s privacy policy, e.g. `https://eulerapp.com/privacy` *(confirm the real URL; optional but recommended — the plugin reads partner data via the MCP)*
- **Submitter email**: `kelvyn@eulerapp.com` *(form is pre-filled with this — confirm it’s the right owner)*

---

## Submission 2 — EULER for Partners

**Plugin information**
- **Link to plugin** (repo URL): `https://github.com/Euler-Software-Inc/EULER-skills`
- **Plugin homepage**: `https://euler-software-inc.github.io/EULER-skills/` *(optional)*
- **Plugin name**: `EULER for Partners`
- **Plugin description**:
  > Self-service Claude skills for partners that orchestrate the EULER platform (via the EULER MCP). View your own performance scorecard with a customer (health score, revenue, deals, commissions, referrals), track your onboarding and certification progress, list the referrals and deal registrations you’ve submitted and where each stands, see your deal pipeline, and submit a new referral through chat. Every skill returns a single self-contained HTML report styled with the EULER design system.
- **Example use cases**:
  ```
  How am I doing this quarter? Show my performance scorecard.
  Where am I in my onboarding and certification?
  What is the status of the referrals I submitted?
  Show my deal pipeline with this customer.
  Submit a new referral for Globex.
  ```

**Submission details**
- **Supported platforms**: ☑ Claude Code. ☑ Claude Cowork only if tested.
- **License type**: `MIT`
- **Privacy policy URL**: `https://eulerapp.com/privacy` *(confirm; optional)*
- **Submitter email**: `kelvyn@eulerapp.com`

---

## Docs / homepage — recommendation

**Create it in the EULER-skills repo, NOT euler-mcp.** euler-mcp is the backend server; plugin docs belong with the plugin repo.

You don’t need the euler domain → use **GitHub Pages on EULER-skills**:
`https://euler-software-inc.github.io/EULER-skills/`

We already have the content: **`showcase/index.html`** (9 skill cards + sample reports) is effectively the landing/docs page, plus the README. Just enable Pages to serve it.

The **homepage field is optional** — you can submit without it today (or point it at the README: `https://github.com/Euler-Software-Inc/EULER-skills#readme`) and add the Pages URL later. A real homepage helps the review and the “Anthropic Verified” odds.

**Caveat (from prior review):** the `.mcp.json` points to the custom EULER MCP (`mcp.eulerapp.com`), which isn’t in Anthropic’s Connectors Directory — this raises user warnings and lowers Verified odds. Consider also submitting the EULER connector to the Connectors Directory.
