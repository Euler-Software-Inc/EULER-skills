---
name: my-tracking-links
description: Create and list a partner's own affiliate tracking links with one customer — wraps a destination URL with an auto-generated tracking id — using EULER MCP tools. Use this skill whenever a partner wants a tracking/affiliate link — phrases like "create a tracking link", "make me an affiliate link", "my tracking links", "a link for my <campaign> campaign", "track this URL". Partner-facing (a partner managing their OWN links).
---

# my-tracking-links — your affiliate tracking links

## When to use this skill

Invoke when **a partner** wants to **create or list their own** affiliate tracking
links with one customer — an interactive write: take a destination URL + a label,
confirm, and create one tracking link (or list the ones they already have).

- "Create a tracking link" / "Make me an affiliate link" / "Track this URL"
- "A link for my {campaign} campaign" / "Generate a referral link for {url}"
- "My tracking links" / "Show me my links" / "What links do I have?"
- `/euler:my-tracking-links`

DO NOT invoke for:

- **A customer admin managing the program's links** — creating/listing tracking links
  here is the partner's own action; a customer admin cannot manage a partner's links
  (the gate blocks them — they manage program links from their dashboard).
- **Submitting a referral / registering a deal** — that is `submit-a-referral`. This
  skill wraps a URL into a trackable link; it does not register a deal.
- **A performance read** ("how am I doing") — that is `my-performance`.

The distinction that selects this skill: **the connected account is the partner, and the
intent is to create or list that partner's OWN tracking/affiliate links.**

## Account type — required: partner

This skill is a **partner action** — managing your own tracking links is the partner's
own action. It needs a connection with a `type === 'partner'` entry.

**Step 1 is always `list_accounts`.** Apply the account gate in
[`references/account-gate.md`](references/account-gate.md) before anything else:

- Connected account has a `type === 'partner'` entry → proceed (partner context); take
  `partner_id` + `affiliate_company_name` from that entry.
- **Customer-only connection** (no `type === 'partner'`) → emit the friendly gate message
  and **STOP** (do not proceed into a raw `forbidden_scope`): "my-tracking-links is a
  partner action — only a partner manages their own tracking links. You're connected as a
  customer admin." Include the `dashboard_url` from the customer entry.
- Both roles → proceed as the partner (use the partner entry).
- Multiple partner accounts → pick by `affiliate_company_name` (the customer the link is
  for); if ambiguous, ask. One partner + customer pairing per invocation.

`partner_id` comes **only** from the chosen `type: 'partner'` entry — **never** from
`partner_directory_search` (its `profile_id` is rejected downstream as
`partner_not_in_consent`). Translate any escaping `forbidden_scope` into the friendly
message; never show the user `forbidden_scope` or any `euler_*` code.

## Flow

Two tools — a list and a create — around an interactive confirm. For exact response
field paths, the `extras` format, and the three create statuses, consult
[`references/mcp-field-paths.md`](references/mcp-field-paths.md).

| # | Step | What happens |
|---|------|--------------|
| 1 | `list_accounts` | Account gate + `partner_id` + customer `affiliate_company_name`. |
| 2a | **To list** | `partner_artifacts(action:'tracking_links', partner_id)` → the partner's existing links (`label` + `link`). Render them. |
| 2b | **To create** | Get an explicit **`url`** (destination, with scheme) + **`label`** (the dedup key) from the user; gather any **`extras`** they want (`key<>value`). **CONFIRM** url + label (+ extras) with the user. |
| 3 | `create_tracking_link(partner_id, url, label, [extras])` | **ONE** write. Returns `{link, status, AI_instruction}` — handle all three statuses (§ Write discipline). |

A "show me my links" request is just step 1 → step 2a (a read, no write). A "create a
link" request runs step 1 → 2b → 3. You may also list (2a) after a create to show the
full set.

## Write discipline (not optional)

`create_tracking_link` is **idempotent by `(partner_id, label)`** — the same label twice
returns the existing link rather than duplicating it. That makes it *safe*, but it is
**still a write**. Treat these as hard constraints:

1. **ONE `create_tracking_link` call per logical request. NEVER poll or retry it in a
   loop.** Idempotency is a safety net, not a license to re-fire. If you must wait on
   anything, poll the **READ** (`partner_artifacts(action:'tracking_links')`) — never the
   write.
2. **Require an explicit `url` + `label` from the user, and CONFIRM before creating.** Do
   not invent a label, guess a destination URL, or auto-create on a vague "make me a
   link" — ask for the URL and the label first, read them back, and create only after the
   user approves.
3. **Handle all three return statuses honestly** (see § Output and `references/`):
   - **`Created`** → a new link was made; show the returned `link`.
   - **`Duplicated`** → a link with that label already existed; surface the **existing**
     URL + message from `AI_instruction`. **Never claim a new link was created** — none
     was.
   - **`Error`** → surface `AI_instruction` as the friendly reason; **never fabricate a
     link** or render a success card.
4. **Pass `extras` only as the user gave them** — each as a literal `key<>value` string
   (the delimiter is `<>`, not `=`/`:`). Omit the arg when there are none; never invent
   tracking parameters.

## Output

A **compact link card** — a single self-contained HTML file (the write's value is the
*action*, not a big report). No external CSS/fonts/scripts beyond the one web-font
import; opens in a browser, prints, or shares by file/link.

### How to produce the HTML
1. Read [`assets/styles.css`](assets/styles.css) and inline its **FULL** contents into a
   single `<style>` block in `<head>` (self-contained — do not `<link>` it). It encodes
   the Euler tokens (Inter + JetBrains Mono, Brand-600 `#2563EB`, the gray/status scales,
   two-layer shadows).
2. Use [`assets/template.html`](assets/template.html) as the structure — fill in the
   label, the link, the status, and the existing-links table; use **ONLY** class names
   defined in the stylesheet. Never improvise colors, fonts, or classes.
3. Model output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding
   markdown, no preamble.

The card shows: hero **`{LABEL}`** with the returned **status** eyebrow and the link
itself in `.mono`; a **"Your tracking links"** table (the new/existing link as a row —
include the partner's other links from `tracking_links` if you listed them); a `.note`
next-step line.

- On **`Created`** → the hero/table show the **new** `link`; the status eyebrow reads
  `Created`.
- On **`Duplicated`** → show the **existing** URL from `AI_instruction` (status eyebrow
  `Duplicated`) and say in the note that this label already existed, so the existing link
  was returned (nothing new was created). Do not present it as a fresh creation.
- On **`Error`** → render **no** success card; reply with the friendly reason from
  `AI_instruction` and what to fix.

**Language — the EULER product is multilingual.** Render ALL card copy (headings, labels,
prose, the status word, the next-step note) in the **language the user used for the
request** — e.g. a Portuguese request → a Portuguese card (`<html lang="pt-BR">`). The
label, the URL/link, proper nouns, and tracking parameters stay as-is. (This applies to
the **rendered card only** — these SKILL instructions and CSS class names stay English.)

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>`
in the topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer — do
**NOT** use an `<img>` logo (the remote brand SVG renders broken in Claude's artifact
viewer). The only external dependency is Google Fonts (`@import` in the stylesheet); keep
the two `<link rel="preconnect">` tags. No JavaScript, no images, no data URIs.

## Anti-hallucination rules (not optional)

1. **No internal IDs in output** — never render `partner_id` or any internal link id;
   they are orchestration-only. The tracking URL itself (and its label) is what the
   partner sees.
2. **`partner_id` source** — only from `list_accounts` (`type:'partner'` entry, matched by
   `affiliate_company_name`). **Never** from `partner_directory_search` (its `profile_id`
   is rejected as `partner_not_in_consent`).
3. **Never fabricate a link.** The link shown is **only** what the tool returned — the new
   `link` on `Created`, or the existing URL from `AI_instruction` on `Duplicated`. On
   `Error` (or any `euler_*` error), surface the friendly reason — no card, no invented
   URL, no invented tracking id.
4. **Never claim a new link on `Duplicated` or `Error`.** A `Created` status is the only
   one that means a new link was made. On `Duplicated`, say the label already existed and
   the existing link was returned; on `Error`, say it could not be created.
5. **One partner + one customer per invocation.** If the user has multiple partner
   accounts, ask which (see § Account type); never create the same link under more than
   one.
6. **One write, no polling.** Exactly one `create_tracking_link` per request; never
   re-issue it to "check" or "confirm" — poll the READ
   (`partner_artifacts(action:'tracking_links')`) if you must verify (see § Write
   discipline).

## Example user flow

```
User: "Create a tracking link for https://eulerapp.com/landing, call it
       'Spring 2026 campaign', and tag it utm_source=google."
       (connected as partner "Lumon Industries", customer "Martus")

Claude:
1. Reads this skill (my-tracking-links playbook).
2. list_accounts → one type:'partner' entry, affiliate_company_name = "Martus"
   → gate passes (partner role); partner_id resolved from that entry.
3. CONFIRMS: "Creating a tracking link for Martus — label 'Spring 2026 campaign',
   destination https://eulerapp.com/landing, extra utm_source<>google. Create it?"
   → user says yes.
4. create_tracking_link(partner_id, url="https://eulerapp.com/landing",
   label="Spring 2026 campaign", extras=["utm_source<>google"]) — ONE call, no
   polling. Returns { status: "Created", link: "https://trk.eulerapp.com/abc123",
   AI_instruction: "" }.
5. Renders the compact link card: hero "Spring 2026 campaign", status eyebrow
   "Created", the new link in .mono; "Your tracking links" table with that row; a
   next-step note. Rendered in the language the user asked in.

Later, same request with the SAME label:
6. create_tracking_link(... label="Spring 2026 campaign" ...) — ONE call. Returns
   { status: "Duplicated", link: "", AI_instruction: "A link with this label already
   exists: https://trk.eulerapp.com/abc123" }.
7. Renders the card with status eyebrow "Duplicated", showing the EXISTING URL from
   AI_instruction, and a note: "This label already existed — here's the link you
   already have." Does NOT claim a new link was created. (No second link was made —
   idempotent by label.)
```

*If step 4/6 had returned `Error` (partner_id didn't resolve, scope/backend issue):
surface the friendly reason from `AI_instruction` and render no card. Never a retry
loop, never a fabricated link.*

## Why this exists

A partner who wants a trackable link for a campaign today has to leave chat and build it
in the portal. my-tracking-links brings it into the conversation: give a destination URL
and a label, confirm, and get back a ready-to-share tracking link — with their existing
links listed alongside. It is the **write** counterpart in the partner self-service
family: one idempotent `create_tracking_link` call, a compact card with the link, and an
honest status (Created vs the existing link on a duplicate).
