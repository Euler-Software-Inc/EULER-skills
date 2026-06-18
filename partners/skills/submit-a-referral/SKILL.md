---
name: submit-a-referral
description: Submit a new referral or deal registration on behalf of a partner through chat — fetches the partner's referral form, collects the answers, and sends it via EULER MCP tools. Use this skill whenever a partner wants to register/submit a referral or deal — phrases like "submit a referral", "register a deal", "send a new referral", "I want to refer a company", "register a company as a deal". Partner-facing write action (only a partner can submit their own referrals — a customer admin cannot).
---

# submit-a-referral — register a referral through chat

## When to use this skill

Invoke when **a partner** wants to **submit a new referral / deal registration** through
chat — an interactive write: fetch the partner's form, collect the answers, confirm, send.

- "Submit a referral" / "Send a new referral" / "I want to refer a company"
- "Register a deal" / "Register {Company} as a deal" / "Log a new deal registration"
- `/euler-partners:submit-a-referral`

DO NOT invoke for:

- **Viewing referrals already submitted** — that is `my-referrals` (the read worklist:
  status of existing referrals). This skill *creates* a new one.
- **A customer admin managing partners' referrals** — submitting is a partner-side action;
  a customer admin cannot submit a partner's referral (the gate blocks them).
- Anything that is not a brand-new referral/deal submission.

The distinction that selects this skill: **the connected account is the partner, and the
intent is to send a NEW referral**, not read existing ones.

## Account type — required: partner

This skill is a **partner write** — submitting a referral is the partner's own action.
It needs a connection with a `type === 'partner'` entry.

**Step 1 is always `list_accounts`.** Apply the account gate in
[`references/account-gate.md`](references/account-gate.md) before anything else:

- Connected account has a `type === 'partner'` entry → proceed (partner context); take
  `partner_id` + `affiliate_company_name` from that entry.
- **Customer-only connection** (no `type === 'partner'`) → emit the friendly gate message
  and **STOP** (do not proceed into a raw `forbidden_scope`): "submit-a-referral is a
  partner action — only a partner can submit their own referrals. You're connected as a
  customer admin." Include the `dashboard_url` from the customer entry.
- Both roles → proceed as the partner (use the partner entry).
- Multiple partner accounts → pick by `affiliate_company_name` (the customer to submit
  to); if ambiguous, ask. One partner + customer pairing per invocation.

`partner_id` comes **only** from the chosen `type: 'partner'` entry — **never** from
`partner_directory_search` (its `profile_id` is rejected downstream as
`partner_not_in_consent`). Translate any escaping `forbidden_scope` into the friendly
message; never show the user `forbidden_scope` or any `euler_*` code.

## Flow (exact — do not deviate)

Two MCP calls bracket an interactive collect-and-confirm. For exact response field paths
and the `answer_field` mapping, consult
[`references/mcp-field-paths.md`](references/mcp-field-paths.md).

| # | Step | What happens |
|---|------|--------------|
| 1 | `list_accounts` | Account gate + `partner_id` + customer `affiliate_company_name`. |
| 2 | `referrals(action:'get_form_for_partner', partner_id)` | Fetch the form → `form_id`, `questions[]` (each with `question_id`, prompt, `answer_field`), `question_count`, `presentation_guidance`. |
| 3 | **Present + collect** | Present the questions to the user **following `presentation_guidance`** (especially for long forms — chunk/group as it says); collect every **required** answer. |
| 4 | **CONFIRM with the user** | Read back the collected answers (referred company + type + key answers) and get an explicit go-ahead **before** sending. |
| 5 | `submit_referral(partner_id, form_id, answers)` | **ONE** write. `answers` = JSON array of `{question_id, answer_text, multiselect_options[]}`; place each value in the field its question's `answer_field` names. |

Then render the confirmation card (§ Output). On error, no success card — surface the
friendly reason instead.

## Write discipline (not optional)

This is a **write** skill — these rules are the whole point. Treat them as hard
constraints, not suggestions:

1. **ONE `submit_referral` call per logical request. NEVER poll or retry it in a loop.**
   A 2026-05-07 retry loop created **30 orphan referral rows** from a single request.
   There is **no polling** of the write — if you must wait for anything, poll a **READ**
   (`referrals(action:'for_partner')`), never the write.
2. **Trust the MCP's server-side preflight.** It validates the answers against the form
   and reifies their shape — do **not** re-implement that validation client-side or
   pre-reject answers it would accept.
3. **`form_id_mismatch` → re-fetch + retry ONCE (deliberate, not blind).** A stale
   `form_id` means the form changed between step 2 and step 5. Re-call
   `get_form_for_partner` for the **fresh** `form_id`, re-map the answers, and call
   `submit_referral` **one** more time. If it still fails, surface the reason and STOP —
   never wrap the submit in a loop.
4. **Never render a "submitted" card on an error.** On `form_id_mismatch` (after the one
   retry), validation failure, `forbidden_scope`, or any `euler_*` error — surface the
   friendly reason + what to fix. A confirmation card means the referral was actually
   created; never imply success that didn't happen.
5. **Confirm before you send (step 4).** The submit only fires after the user has seen
   the collected answers and approved them.

## Output

A **compact confirmation card** — a single self-contained HTML file (the write's value is
the *action*, not a big report). No external CSS/fonts/scripts beyond the one web-font
import; opens in a browser, prints, or shares by file/link.

### How to produce the HTML
1. Read [`assets/styles.css`](assets/styles.css) and inline its **FULL** contents into a
   single `<style>` block in `<head>` (self-contained — do not `<link>` it). It encodes
   the Euler tokens (Inter + JetBrains Mono, Brand-600 `#2563EB`, the gray/status scales,
   two-layer shadows).
2. Use [`assets/template.html`](assets/template.html) as the structure — fill in the
   submitted data; use **ONLY** class names defined in the stylesheet. Never improvise
   colors, fonts, or classes.
3. Model output is the complete HTML (`<!DOCTYPE html>` → `</html>`) — no surrounding
   markdown, no preamble.

The card shows: hero **"Referral sent — {referred company}"** with the returned status
eyebrow; quick-facts **Type · Submitted to (customer) · Status**; a **"What you
submitted"** table (one row per question → the answer you sent); a `.note` next-step line.
Keep it compact — one screen, the key answers, not every internal field.

**On error → NO success card.** Do not render the confirmation card at all if the submit
errored; instead reply with the friendly reason and what to fix (see § Write discipline).

**Language — the EULER product is multilingual.** Render ALL card copy (headings, labels,
the question prompts, prose, next-step note) in the **language the user used for the
request** — e.g. a Portuguese request → a Portuguese card (`<html lang="pt-BR">`). Proper
nouns, the referred company, currency, and dates stay as-is. (This applies to the
**rendered card only** — these SKILL instructions and CSS class names stay English.)

**Brand is a text wordmark, not an image.** Render `<span class="brand-mark">Euler</span>`
in the topbar and `<span class="brand-mark footer-mark">Euler</span>` in the footer — do
**NOT** use an `<img>` logo (the remote brand SVG renders broken in Claude's artifact
viewer). The only external dependency is Google Fonts (`@import` in the stylesheet); keep
the two `<link rel="preconnect">` tags. No JavaScript, no images, no data URIs.

## Anti-hallucination rules (not optional)

1. **No internal IDs in output** — never render `partner_id`, `form_id`, `question_id`, or
   the new referral's internal id; they are orchestration-only.
2. **`partner_id` source** — only from `list_accounts` (`type:'partner'` entry, matched by
   `affiliate_company_name`). **Never** from `partner_directory_search` (its `profile_id`
   is rejected as `partner_not_in_consent`).
3. **Never claim success on an error.** A confirmation card is rendered **only** after a
   real successful `submit_referral`. On any error, surface the friendly reason — never a
   card, never an invented status.
4. **Place each answer in the right field.** Use each question's `answer_field`
   (`answer_text` vs `multiselect_options`) to decide where the value goes — almost always
   `answer_text`; only a true multi-select uses `multiselect_options`. Send the user's
   actual answers, never fabricated ones; don't invent answers to "required" questions the
   user didn't answer — ask.
5. **One partner + one customer per invocation.** If the user has multiple partner
   accounts, ask which (see § Account type); never submit under more than one.
6. **One write, no polling.** Exactly one `submit_referral` per request; never re-issue it
   to "check" or "confirm" — poll a READ if you must wait (see § Write discipline).

## Example user flow

```
User: "I want to register a new deal with Martus."  (connected as partner "Lumon Industries")

Claude:
1. Reads this skill (submit-a-referral playbook).
2. list_accounts → one type:'partner' entry, affiliate_company_name = "Martus"
   → gate passes (partner role); partner_id resolved from that entry.
3. referrals(action:'get_form_for_partner', partner_id) → form_id + 3 questions
   (Company name [answer_text, required], Contact email [answer_text, required],
   Estimated deal size [answer_text, required]) + presentation_guidance.
4. Presents the 3 questions per presentation_guidance; collects:
   Company = "Initech", Contact email = "ops@initech.com", Deal size = "$40,000".
5. CONFIRMS: "Submitting to Martus — Initech · ops@initech.com · $40,000. Send it?"
   → user says yes.
6. submit_referral(partner_id, form_id, answers=[{question_id, answer_text}×3]) — ONE call,
   no polling, no retry. Returns status "Created".
7. Renders the compact confirmation card: hero "Referral sent — Initech", status eyebrow
   "Created"; quick-facts Type "Deal registration" · Submitted to "Martus" · Status
   "Created"; "What you submitted" table (3 rows); next-step note. Rendered in the
   language the user asked in.

(If step 6 had returned form_id_mismatch: re-fetch the form for the fresh form_id, re-map
the 3 answers, submit ONCE more. Still failing → friendly reason, no success card. Never a
retry loop.)
```

## Why this skill exists

A partner registering a deal today has to leave chat, find the right form in the portal,
and fill it there. submit-a-referral brings the whole flow into the conversation: fetch the
partner's form, collect the answers, confirm, and send — one `submit_referral` call, with a
compact card confirming exactly what was registered. It is the **write** counterpart to
`my-referrals` (which reads the partner's existing referrals): this one creates a new
referral; that one tracks where they stand.
