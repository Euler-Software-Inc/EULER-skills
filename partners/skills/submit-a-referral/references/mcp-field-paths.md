# submit-a-referral — MCP field paths & quirks (partner write)

`partner_id` resolves from `list_accounts` (entry with `type:'partner'`, match
`affiliate_company_name`). Never from `partner_directory_search`.

This skill is a **two-call flow**: fetch the form, then submit. The submit is the only
write — it runs **exactly once** per logical request (see SKILL.md § Write discipline).

## Step A — `referrals(action:'get_form_for_partner', partner_id)`  — fetch the form

Returns the form the partner must fill, scoped to that partner's program:

```
form_id                 the form's id — pass it back UNCHANGED to submit_referral
question_count          number of questions on the form
presentation_guidance   how to present the form to the user — FOLLOW IT (esp. for long
                        forms: it may say to chunk, group, or ask only required first)
questions[]             one entry per question:
  question_id           the question's id — echo back in each answer
  (prompt text)         the question label/prompt to show the user
  answer_field          "answer_text" | "multiselect_options" — WHICH field this
                        question's answer goes in (almost always "answer_text";
                        only a true multi-select question uses "multiselect_options")
  (required?)           collect every REQUIRED answer before submitting
  (options?)            for a multiselect question, the allowed option values
```

- **Follow `presentation_guidance`.** It is the form author's instruction for how to ask
  — honor it rather than dumping all questions at once on a long form.
- Note each question's `answer_field` — it decides where you place that answer's value.

## Step B — `submit_referral(partner_id, form_id, answers)`  — the write (once)

```
partner_id   from the partner entry (same as Step A)
form_id      the EXACT form_id Step A returned (unchanged)
answers      JSON array, one object per answered question:
             [{ question_id, answer_text, multiselect_options[] }, ...]
```

- Place each value in the field its question's `answer_field` names:
  - `answer_field: "answer_text"`  → put the value in `answer_text` (leave
    `multiselect_options` empty/absent).
  - `answer_field: "multiselect_options"` → put the chosen option value(s) in
    `multiselect_options` (an array; leave `answer_text` empty/absent).
- The MCP runs a **server-side preflight** that validates the answers against the form
  and reifies the shape — **trust it; do not re-implement** that validation client-side.

### Returns / status
- Success → a status (e.g. `Created`) for the new referral. Render the confirmation card.
- On **any** error → surface the friendly reason + what to fix; do **NOT** render a
  "submitted" card. Never show a raw `euler_*` code.

## `form_id_mismatch` — re-fetch + retry ONCE (deliberate, not a loop)

`form_id` is validated against the partner's **current** form. If the form changed
between Step A and Step B, the submit returns `form_id_mismatch`. Handle it as a single
deliberate re-fetch:

1. Call `get_form_for_partner` again → get the **fresh** `form_id` (+ re-check questions).
2. Re-map the collected answers onto the fresh form; call `submit_referral` **once** more
   with the new `form_id`.
3. If it still fails → surface the friendly reason and STOP. **Never** wrap the submit in
   a retry loop (the 2026-05-07 retry loop created 30 orphan referral rows).

## Quirks
- All field values are strings — send answers as the strings the user gave.
- One partner + one customer per invocation; one `submit_referral` call per request.
- If you must wait on anything, poll a **READ** (e.g. `referrals(action:'for_partner')`)
  — never re-issue the write to "check".
