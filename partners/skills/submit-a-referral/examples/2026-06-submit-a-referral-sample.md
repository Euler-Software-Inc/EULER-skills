# Example — submit-a-referral flow (sanitized, illustrative)

> Illustrative — `referrals(action:'get_form_for_partner')` / `submit_referral`
> response shapes may shift; refresh against a real run once available.

**Prompt:** "I want to register a new deal with Martus."

**Partner:** Lumon Industries · Customer: Martus

---

## Call sequence

1. `list_accounts` → one `type:'partner'` entry, `affiliate_company_name = "Martus"`;
   `partner_id` resolved from that entry. Gate passes (partner role).
2. `referrals(action:'get_form_for_partner', partner_id)` → `form_id` + `question_count: 3`
   + `presentation_guidance` ("short form — ask all three together"). `questions[]`:

   | question_id | Prompt | answer_field | required |
   |---|---|---|---|
   | q_company | Company name | `answer_text` | yes |
   | q_email | Primary contact email | `answer_text` | yes |
   | q_size | Estimated deal size (USD) | `answer_text` | yes |

3. **Present + collect** (per `presentation_guidance`, all three at once). User answers:
   - Company name → **Initech**
   - Primary contact email → **ops@initech.com**
   - Estimated deal size → **$40,000**

4. **CONFIRM with the user** (before any write):
   > "Registering a deal with **Martus** — Initech · ops@initech.com · $40,000. Send it?"

   User: "Yes, send it." → only now does the write fire.

5. `submit_referral(partner_id, form_id, answers)` — **ONE** call:
   ```json
   [
     { "question_id": "q_company", "answer_text": "Initech" },
     { "question_id": "q_email",   "answer_text": "ops@initech.com" },
     { "question_id": "q_size",    "answer_text": "$40,000" }
   ]
   ```
   Each value sits in `answer_text` (every question's `answer_field` was `answer_text`;
   no `multiselect_options`). The MCP's server-side preflight validates the shape — not
   re-implemented here. Returns status **`Created`**.

> **No polling, no retry loop.** The write is issued exactly once. We do NOT re-call
> `submit_referral` to "confirm it landed" — that is the exact pattern that created 30
> orphan rows on 2026-05-07. If we needed to verify, we would poll the READ
> (`referrals(action:'for_partner')`), never the write.

---

## Rendered confirmation card — key decisions

**Hero** → "Referral sent — **Initech**"; eyebrow status "Created".

**Quick facts**
| Type | Submitted to | Status |
|---|---|---|
| Deal registration | Martus | Created |

**What you submitted**
| Question | Your answer |
|---|---|
| Company name | Initech |
| Primary contact email | ops@initech.com |
| Estimated deal size (USD) | $40,000 |

**Next-step note** → "Martus has received your registration; track its status with
`/euler:my-referrals`."

**Footer** → `euler · submit-a-referral`

---

## Error branch — `form_id_mismatch` (illustrative)

If step 5 had returned `form_id_mismatch` (the form changed between fetch and submit):

1. Re-call `referrals(action:'get_form_for_partner', partner_id)` → **fresh** `form_id`
   (re-check the questions still match what we collected).
2. Re-map the 3 collected answers onto the fresh form; call `submit_referral` **once** more
   with the new `form_id`.
3. Still failing → reply with the friendly reason ("Martus updated the referral form —
   please re-open it so we can capture the new fields") and **render no card**. Never a
   third blind attempt, never a loop.

*Note: this is a WRITE skill — a confirmation card is rendered ONLY after a real successful
submit. On any error, the card is suppressed and the friendly reason is surfaced instead.*
