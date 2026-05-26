---
name: <kebab-case-skill-name>
description: <One sentence — what the skill does + when to use it. Keep under ~280 chars. Include trigger phrases like "Use when the user asks for X, Y, or Z" so Claude knows to invoke.>
---

# <Human-readable skill title>

> Template for new skills in this plugin. Copy this folder, rename to your
> skill name (must match the `name:` field in frontmatter), and replace
> every `<placeholder>`. Delete this blockquote when done.

## When to use this skill

Invoke this skill when the user types any of:

- "<trigger phrase 1>"
- "<trigger phrase 2>"
- "<trigger phrase 3>"
- `/euler:<skill-name>`

DO NOT invoke for:

- <out-of-scope case 1>
- <out-of-scope case 2>

## Inputs needed from user

Before running, confirm:

### 1. <Input name>

- <How to accept the input — name, ID, free text>
- <How to resolve / disambiguate if ambiguous>
- <What to do if the input can't be resolved>

### 2. <Input name>

(repeat as needed)

## Orchestration sequence

Run these EULER MCP tools in order:

| # | Tool call | Provides |
|---|-----------|----------|
| 1 | `<mcp_tool_name>(<params>)` | <What this step contributes to the output> |
| 2 | `<mcp_tool_name>(<params>)` | <...> |

### Tool-by-tool response field paths

The MCP backend returns inconsistent field names. Document the **exact**
paths you'll consume — verified against staging. Do NOT invent field
names. If a path you'd want is missing, the field doesn't exist.

#### `<mcp_tool_name>`
```
<field_path_1>
<field_path_2>
```

### Error handling during orchestration

- **`<error_code>`** → <what to do>
- **Any single tool returning empty data mid-sequence** → continue. The
  output format handles missing sections gracefully.

## Output format

Render a single markdown document. Use this exact structure:

```markdown
# <Title>

<sections...>

## Suggested action items

> DRAFT — <user role> to confirm. Items below are inferences from the
> data above, not commitments.

- <bullet>
```

## Anti-hallucination rules

These rules are **not optional**. Every output must follow them.

1. **NEVER fabricate metrics.** If a tool returns empty data, write
   "No <X> data" and omit the section. Don't invent numbers.
2. **<rule specific to this skill>**
3. **<rule specific to this skill>**

## Example user flow

```
User: "<example trigger>"

Claude:
1. Reads this skill
2. <tool call 1> → <observed behavior>
3. <tool call 2> → <observed behavior>
4. Renders <output>
```

## Why this skill exists

<One paragraph — the manual workflow this replaces, and the time/quality win.>
