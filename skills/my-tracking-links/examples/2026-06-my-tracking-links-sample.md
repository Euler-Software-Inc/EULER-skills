# Example — my-tracking-links flow (sanitized, illustrative)

> Illustrative — `partner_artifacts(action:'tracking_links')` / `create_tracking_link`
> response shapes may shift; refresh against a real run once available. The tracking
> URLs below are made-up placeholders.

**Prompt:** "Create a tracking link for https://eulerapp.com/landing, call it
'Spring 2026 campaign', and tag it utm_source=google."

**Partner:** Lumon Industries · Customer: Martus

---

## Call sequence

1. `list_accounts` → one `type:'partner'` entry, `affiliate_company_name = "Martus"`;
   `partner_id` resolved from that entry. Gate passes (partner role).
2. **CONFIRM with the user** (before any write):
   > "Creating a tracking link for **Martus** — label **'Spring 2026 campaign'**,
   > destination `https://eulerapp.com/landing`, extra `utm_source<>google`. Create it?"

   User: "Yes, create it." → only now does the write fire.
3. `create_tracking_link(partner_id, url, label, extras)` — **ONE** call:
   ```json
   {
     "partner_id": "<from list_accounts>",
     "url": "https://eulerapp.com/landing",
     "label": "Spring 2026 campaign",
     "extras": ["utm_source<>google"]
   }
   ```
   Note `extras` uses the literal `<>` delimiter (not `=`/`:`). Returns:
   ```json
   { "status": "Created", "link": "https://trk.eulerapp.com/abc123", "AI_instruction": "" }
   ```

> **No polling, no retry loop.** The write is issued exactly once. We do NOT re-call
> `create_tracking_link` to "confirm it landed". `create_tracking_link` is idempotent by
> `(partner_id, label)`, but that is a safety net — not a reason to re-fire. If we needed
> to verify, we'd poll the READ (`partner_artifacts(action:'tracking_links')`), never the
> write.

---

## Rendered link card — key decisions (Created)

**Hero** → "**Spring 2026 campaign**"; eyebrow status "Created"; the new link in `.mono`:
`https://trk.eulerapp.com/abc123`.

**Your tracking links**
| Label | Link |
|---|---|
| **Spring 2026 campaign** | `https://trk.eulerapp.com/abc123` |
| Q1 webinar | `https://trk.eulerapp.com/web019` |

(The second row is an existing link surfaced from
`partner_artifacts(action:'tracking_links')` — optional, shown when we list alongside.)

**Note** → "Share this link to track clicks and conversions for the Spring 2026 campaign.
See all your links any time with `/euler:my-tracking-links`."

**Footer** → `euler · my-tracking-links`

---

## Listing existing links (read-only, no write)

**Prompt:** "Show me my tracking links."

1. `list_accounts` → gate + `partner_id` (as above).
2. `partner_artifacts(action:'tracking_links', partner_id)` → existing links:

   | Label | Link |
   |---|---|
   | Spring 2026 campaign | `https://trk.eulerapp.com/abc123` |
   | Q1 webinar | `https://trk.eulerapp.com/web019` |

   Rendered into the same card (no hero "Created" status — it's a listing). No write
   fires for a list request.

---

## Duplicate branch — same label again (idempotent)

If we call `create_tracking_link` again with the **same** `label`
("Spring 2026 campaign"):

```json
{ "status": "Duplicated", "link": "",
  "AI_instruction": "A link with this label already exists: https://trk.eulerapp.com/abc123" }
```

1. `status` is **`Duplicated`** and `link` is **empty** — nothing new was created
   (idempotent by `(partner_id, label)`).
2. Render the card with status eyebrow **"Duplicated"**, showing the **existing** URL
   from `AI_instruction` (`https://trk.eulerapp.com/abc123`), and a note:
   > "This label already existed — here's the link you already have. Pick a different
   > label to create a new one."
3. We do **NOT** claim a new link was created, and we do **NOT** fabricate a second URL.

---

## Error branch — `Error` (illustrative)

If `create_tracking_link` returns:

```json
{ "status": "Error", "link": "",
  "AI_instruction": "We couldn't create the link — your partner account couldn't be resolved. Reconnect and include this account in your consent selection." }
```

- Surface the friendly reason from `AI_instruction` and **render no card** — `link` is
  empty and nothing was created.

*Note: this is a WRITE skill — a link card showing a `Created` link is rendered ONLY after
a real successful create. On `Duplicated` the card shows the EXISTING link (not a new
one); on `Error` no card is rendered and the friendly reason is surfaced instead. Never a
retry loop, never a fabricated link.*
