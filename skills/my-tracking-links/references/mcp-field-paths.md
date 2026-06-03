# my-tracking-links — MCP field paths & quirks (partner write, idempotent)

`partner_id` resolves from `list_accounts` (entry with `type:'partner'`, match
`affiliate_company_name`). Never from `partner_directory_search` (its `profile_id` is
rejected downstream as `partner_not_in_consent`).

This skill has **two tools**: list the partner's existing links, and create one. The
create is the only write — it runs **exactly once** per logical request (see SKILL.md
§ Write discipline). It is **idempotent by `(partner_id, label)`**: the same label twice
does not create a second link — it returns the existing one.

## List — `partner_artifacts(action:'tracking_links', partner_id)`

Returns the partner's existing tracking links for that program:

```
tracking_links[]        one entry per existing link:
  label                 the human label the partner gave it (also the dedup key)
  link                  the full tracking URL (scheme + host + path + tracking id)
```

- Use this to show the partner what they already have, and to check whether a label is
  already taken **before** offering to create (so you can set expectations).

## Create — `create_tracking_link(partner_id, url, label, [extras])`  — the write (once)

```
partner_id   from the partner entry (same as the list call)
url          the destination URL to wrap — FULL, including scheme (https://…). The
             partner supplies it; do not invent or normalize away the scheme.
label        a human-readable name for the link. THIS IS THE DEDUP KEY — the same
             label for the same partner returns the existing link (idempotent),
             it does not create a duplicate. Require an explicit label from the user.
extras       OPTIONAL array of "key<>value" strings — the separator is a LITERAL
             two-character `<>` (e.g. "utm_source<>google", "utm_campaign<>spring").
             Only include extras the user actually gave; omit the arg if none.
```

- `extras` are appended as parameters on the generated link. Each element is one
  `key<>value` string with the literal `<>` delimiter — not `=`, not `:`.

### Returns — `{ link, status, AI_instruction }` — THREE statuses (handle all honestly)

```
status        "Created" | "Duplicated" | "Error"
link          the tracking URL — populated on Created; EMPTY on Duplicated/Error
AI_instruction a message to surface to the user (carries the existing URL on
              Duplicated; the remediation on Error)
```

- **`Created`** — a new link was made. `link` is the new tracking URL → render it in
  the card with the `Created` status.
- **`Duplicated`** — a link with that `label` already exists (idempotent no-op). `link`
  is **empty**; `AI_instruction` carries the **existing** URL + a message. Surface that
  existing URL and the message — render the card with the `Duplicated` status. **Do NOT
  claim a new link was created**; nothing was created.
- **`Error`** — the `partner_id` didn't resolve (or a scope/backend issue). `link` is
  empty; surface `AI_instruction` as the friendly reason. **Do NOT fabricate a link**;
  render no success card.

## Quirks

- All field values are strings — pass `url` / `label` / each `extra` as the strings the
  user gave.
- Idempotent by `(partner_id, label)` — re-running the same `(label, url)` returns
  `Duplicated` with the existing link, never a second row. This is safe, but it is still
  a **write**: issue exactly one `create_tracking_link` per request; never poll/retry it.
- One partner + one customer per invocation.
- If you must wait on anything, poll the **READ**
  (`partner_artifacts(action:'tracking_links')`) — never re-issue the write to "check".
