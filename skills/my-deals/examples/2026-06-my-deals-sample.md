# my-deals — illustrative sample output

> **Illustrative — refresh against a real run.** The data below represents a plausible
> partner pipeline used to validate skill behavior. Always regenerate from live MCP data
> before sharing with a partner.

---

## Scenario

**Partner:** Severtance Analytics
**Customer:** Lumon Industries / Martus
**Request:** "Show me my pipeline."

---

## MCP calls (illustrative)

### 1. list_accounts

```json
{
  "accounts": [
    {
      "type": "partner",
      "partner_id": "p_sev001",
      "affiliate_company_name": "Martus",
      "dashboard_url": "https://app.eulerapp.com/partner/sev001"
    }
  ]
}
```

Gate passes — `type: 'partner'` found. `partner_id = "p_sev001"`, customer = "Martus".

### 2. partner_artifacts(action:'deals', partner_id='p_sev001')

```json
[
  { "Deal name": "Severtance – Core Module",   "stage": "Qualified",    "Amount": "8500",   "last_stage_change_date": "493" },
  { "Deal name": "Severtance – Reporting Add-on","stage": "Qualified",  "Amount": "4200",   "last_stage_change_date": "9999" },
  { "Deal name": "Severtance – API Integration","stage": "Demo",        "Amount": "14000",  "last_stage_change_date": "31" },
  { "Deal name": "Severtance – Enterprise Pkg", "stage": "Demo",        "Amount": "22000",  "last_stage_change_date": "9999" },
  { "Deal name": "Severtance – Compliance Tier","stage": "Negotiating", "Amount": "11800",  "last_stage_change_date": "18" },
  { "Deal name": "Severtance – Pilot Renewal",  "stage": "Contracting", "Amount": "9900",   "last_stage_change_date": "7" },
  { "Deal name": "Severtance – Year 1 Rollout", "stage": "Closed Won",  "Amount": "31000",  "last_stage_change_date": "9999" },
  { "Deal name": "Severtance – Proof of Value",  "stage": "Closed Won",  "Amount": "7200",   "last_stage_change_date": "9999" }
]
```

---

## Computed values

| Metric | Value |
|--------|-------|
| Open deals | 6 |
| Open value | $70,400 |
| Stages with open deals | 4 (Qualified, Demo, Negotiating, Contracting) |
| Avg open deal size | $11,733 |
| Closed-won count | 2 |
| Closed-won value | $38,200 |

---

## Aging applied correctly

| Deal | last_stage_change_date | Render aging? |
|------|------------------------|---------------|
| Severtance – Core Module | 493 | Yes — "493 days in stage" |
| Severtance – Reporting Add-on | 9999 | No — sentinel, omit .cell-note |
| Severtance – API Integration | 31 | Yes — "31 days in stage" |
| Severtance – Enterprise Pkg | 9999 | No — sentinel, omit .cell-note |
| Severtance – Compliance Tier | 18 | Yes — "18 days in stage" |
| Severtance – Pilot Renewal | 7 | Yes — "7 days in stage" |

---

## Expected HTML output (abbreviated)

### Hero quick-facts

- **Open deals:** 6 · across 4 stages
- **Open value:** $70,400 · total pipeline
- **Closed-won:** 2 · $38,200 lifetime
- **Avg deal size:** $11,733 · open deals average

### 01 · Open pipeline table

| Stage | Deal | Amount |
|-------|------|--------|
| Qualified | **Severtance – Core Module** _(493 days in stage)_ | $8,500 |
| Qualified | **Severtance – Reporting Add-on** | $4,200 |
| Demo | **Severtance – Enterprise Pkg** | $22,000 |
| Demo | **Severtance – API Integration** _(31 days in stage)_ | $14,000 |
| Negotiating | **Severtance – Compliance Tier** _(18 days in stage)_ | $11,800 |
| Contracting | **Severtance – Pilot Renewal** _(7 days in stage)_ | $9,900 |

Note: "Reporting Add-on" and "Enterprise Pkg" have `last_stage_change_date = 9999` → no aging shown.
Rollup note: "Total open: $70,400 across 6 deals in 4 stages."

### 02 · By stage distribution

- 🔵 Qualified — 2
- 🟡 Demo — 2
- 🟣 Negotiating — 1
- 🟢 Contracting — 1

---

## Validation checklist

- [ ] `last_stage_change_date < 9999` → aging rendered
- [ ] `last_stage_change_date >= 9999` → no `.cell-note` (sentinel omitted)
- [ ] Closed-won appears only in hero quick-facts, not in pipeline table
- [ ] Closed-lost: $0 total → omitted entirely
- [ ] No `partner_id` or internal IDs in rendered output
- [ ] All `Amount` values parsed via `Number()` before display
- [ ] Stage order: Qualified → Demo → Negotiating → Contracting (funnel order)
- [ ] Within each stage: largest amount first
- [ ] No `<img>` tags; text wordmark only
- [ ] CSS inlined (no `<link>` to styles.css)
