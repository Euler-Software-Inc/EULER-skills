#!/usr/bin/env node
// EULER-skills quality gate. Run before every push (the .githooks/pre-push hook does
// this automatically; CI re-runs it on PRs). Checks plugin/skill best practices +
// public-repo hygiene, and reports skill-template sizes. ERRORS block (exit 1);
// WARNINGS surface only. On pull requests the Markdown summary (check table +
// template-size table) is written to the run's job summary and posted as a sticky
// PR comment.
//
//   node scripts/quality-gate.mjs
//
import { readFileSync, existsSync, readdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const read = (p) => readFileSync(join(root, p), 'utf8');
const tracked = sh('git ls-files').split(/\r?\n/).filter(Boolean);

const errors = [];
const warns = [];
const checks = []; // { name, ok } per check — drives the summary check table
const check = (name, fn) => { const n = errors.length; fn(); checks.push({ name, ok: errors.length === n }); };
const SKILL_RE = /^(partner-managers|partners)\/skills\/([^/]+)\/SKILL\.md$/;
const skillFiles = tracked.filter((f) => SKILL_RE.test(f));
const skillDirs = [...new Set(skillFiles.map((f) => f.replace(/\/SKILL\.md$/, '')))];
const kebab = (s) => typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

// ── checks (errors block) ─────────────────────────────────────────────────

// 1. Manifests valid. Node-level structural checks run everywhere (incl. CI);
//    `claude plugin validate` adds the official check when the CLI is present (local).
function validateManifests() {
  let mkt;
  try { mkt = JSON.parse(read('.claude-plugin/marketplace.json')); }
  catch (e) { errors.push(`.claude-plugin/marketplace.json: invalid JSON (${e.message})`); return; }
  if (!mkt.name) errors.push('marketplace.json: missing "name"');
  if (!Array.isArray(mkt.plugins) || mkt.plugins.length === 0) { errors.push('marketplace.json: "plugins" must be a non-empty array'); return; }
  for (const p of mkt.plugins) {
    if (!kebab(p.name)) errors.push(`marketplace.json: plugin name '${p.name}' not kebab-case`);
    if (typeof p.source !== 'string') { errors.push(`marketplace.json: plugin '${p.name}' missing string "source"`); continue; }
    const dir = p.source.replace(/^\.\//, '');
    if (!existsSync(join(root, dir))) { errors.push(`marketplace.json: source '${p.source}' does not exist`); continue; }
    const mp = `${dir}/.claude-plugin/plugin.json`;
    if (!existsSync(join(root, mp))) { errors.push(`${dir}: missing .claude-plugin/plugin.json`); continue; }
    let pj;
    try { pj = JSON.parse(read(mp)); }
    catch (e) { errors.push(`${mp}: invalid JSON (${e.message})`); continue; }
    if (pj.name !== p.name) errors.push(`${mp}: name '${pj.name}' != marketplace entry '${p.name}'`);
    else if (!kebab(pj.name)) errors.push(`${mp}: name '${pj.name}' not kebab-case`);
    if (!pj.version) errors.push(`${mp}: missing "version"`);
    if (!pj.description) errors.push(`${mp}: missing "description"`);
    const mcp = `${dir}/.mcp.json`;
    if (existsSync(join(root, mcp))) { try { JSON.parse(read(mcp)); } catch (e) { errors.push(`${mcp}: invalid JSON (${e.message})`); } }
  }
}
let claudeOk = true;
try { sh('claude --version'); } catch { claudeOk = false; }
check('Manifests', () => {
  validateManifests();
  if (claudeOk) for (const p of ['.', './partner-managers', './partners']) {
    let out = '';
    try { out = sh(`claude plugin validate ${p}`); }
    catch (e) { out = (e.stdout || '').toString() + (e.stderr || '').toString(); }
    if (!/Validation passed/.test(out)) errors.push(`manifest invalid: ${p}\n${out.trim()}`);
  }
});

// 2. Canonical assets in sync
check('Canonical sync', () => {
  try { sh('node scripts/check-core-sync.mjs'); }
  catch (e) { errors.push(`canonical sync failed:\n${(e.stdout || e.message || '').toString().trim()}`); }
});

// 3. Skill frontmatter: name (== folder, kebab-case) + description; no angle brackets in description
check('Skill frontmatter', () => {
  for (const f of skillFiles) {
    const folder = f.match(SKILL_RE)[2];
    const txt = read(f);
    const fm = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) { errors.push(`${f}: missing YAML frontmatter`); continue; }
    const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim();
    const desc = (fm[1].match(/^description:\s*([\s\S]*?)$/m) || [])[1]?.trim();
    if (!name) errors.push(`${f}: frontmatter missing 'name'`);
    else if (name !== folder) errors.push(`${f}: name '${name}' != folder '${folder}'`);
    else if (!kebab(name)) errors.push(`${f}: name '${name}' not kebab-case`);
    if (!desc) errors.push(`${f}: frontmatter missing 'description'`);
    else if (/[<>]/.test(desc)) errors.push(`${f}: description contains angle bracket(s) — skill will silently fail to load`);
  }
});

// 4. No legacy CSS tokens in shipped CSS-bearing files (templates, styles.css, examples) + core
check('No legacy CSS tokens', () => {
  const LEGACY = /--(brand|gray|error|warning|success|violet|cyan|pink|shadow)-/;
  for (const f of tracked) {
    if (!/^(partner-managers|partners)\/skills\/[^/]+\/(assets\/(template\.html|styles\.css)|examples\/.+\.html)$/.test(f) && !/^core\/.+\.css$/.test(f)) continue;
    if (LEGACY.test(read(f))) errors.push(`${f}: contains legacy CSS token (must use canonical aliases --b6/--g5/…)`);
  }
});

// 5. English-only in shipped content (no high-signal PT-BR function words)
check('English-only', () => {
  const PT = /\b(n[ãa]o|voc[êe]s?|est[ãa]o?|ent[ãa]o|tamb[ée]m|porqu[êe]|isso|agora|pra|vc|deixar|nosso|fazer|criar|p[áa]gina|arquivo)\b/i;
  const englishScope = tracked.filter((f) => /\.(md|html)$/.test(f) && !/^docs\//.test(f) && f !== 'README.md' ? true : /^(README|CONTRIBUTING)\.md$|^(partner-managers|partners)\/skills\/|^showcase\/index\.html$/.test(f));
  for (const f of englishScope) {
    const m = read(f).match(PT);
    if (m) errors.push(`${f}: possible PT-BR text ("${m[0]}") — shipped content must be English`);
  }
});

// 6. No real Bubble IDs (allow the all-zeros placeholder)
check('No Bubble IDs', () => {
  const BUBBLE = /\b(\d{10,})x(\d{6,})\b/g;
  for (const f of tracked.filter((f) => /SKILL\.md$|examples\/.+\.(md|html)$/.test(f) && /^(partner-managers|partners)\//.test(f))) {
    for (const m of read(f).matchAll(BUBBLE)) if (!/^0+$/.test(m[2])) errors.push(`${f}: real-looking Bubble ID '${m[0]}' — sanitize to …x000…`);
  }
});

// 7. No secrets
check('No secrets', () => {
  const SECRET = /(sk-[a-z0-9]{16,}|bearer\s+[a-z0-9._-]{12,}|api[_-]?key\s*[:=]\s*['"]?[a-z0-9]{12,}|password\s*[:=]\s*['"]?\S{6,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
  for (const f of tracked) {
    if (!/\.(md|html|json|mjs|js|css|txt|ya?ml|sh)$/.test(f)) continue;
    const m = read(f).match(SECRET);
    if (m) errors.push(`${f}: possible secret ("${m[0].slice(0, 24)}…")`);
  }
});

// 8. HTML lightweight — skill templates + example renders: no <script>, <img>, base64
check('Lightweight HTML', () => {
  for (const f of tracked.filter((f) => /^(partner-managers|partners)\/skills\/[^/]+\/(assets\/template\.html|examples\/.+\.html)$/.test(f))) {
    const t = read(f);
    if (/<script[\s>]/i.test(t)) errors.push(`${f}: contains <script> (skill HTML must be JS-free)`);
    if (/<img[\s>]/i.test(t)) errors.push(`${f}: contains <img> (use the text wordmark, no images)`);
    if (/data:[^;'"]*;base64,/i.test(t)) errors.push(`${f}: contains a base64 data-URI (not allowed)`);
  }
});

// 9. Each skill has >=1 example
check('Examples present', () => {
  for (const d of skillDirs) {
    const ex = join(root, d, 'examples');
    if (!existsSync(ex) || readdirSync(ex).filter((n) => !n.startsWith('.')).length === 0) errors.push(`${d}: no example under examples/`);
  }
});

// 10. No internal dev docs / local working files tracked
check('No dev docs tracked', () => {
  const devdocs = tracked.filter((f) => /^docs\/(plans|specs)\//.test(f) || /^\.claude\//.test(f) || f === 'PLAN-account-aware-skills.md');
  if (devdocs.length) errors.push(`internal dev docs / local working files are tracked (should be gitignored): ${devdocs.join(', ')}`);
});

// ── warnings (surface only) ───────────────────────────────────────────────
// Non-eulerapp emails (allowlist: eulerapp.com + RFC example.* + the initech.com fictional sample) + staging/localhost URLs.
const EMAIL = /[a-z0-9._%+-]+@(?!eulerapp\.com\b|example\.(?:com|org|net)\b|initech\.com\b)[a-z0-9.-]+\.[a-z]{2,}/gi;
const URLISH = /(https?:\/\/[^\s"'<)]*staging[^\s"'<)]*|staging\.[a-z0-9.-]+|localhost(:\d+)?|127\.0\.0\.1)/i;
const seenEmail = new Set();
for (const f of tracked) {
  if (!/\.(md|html|json|mjs|js|css|txt|ya?ml)$/.test(f)) continue;
  if (/^(scripts|\.github)\//.test(f)) continue; // tooling holds pattern literals (localhost, sk-, …)
  const t = read(f);
  for (const e of t.match(EMAIL) || []) { const k = e.toLowerCase(); if (!seenEmail.has(k)) { seenEmail.add(k); warns.push(`non-eulerapp email "${e}" (${f}) — confirm fictional/sample`); } }
  const u = t.match(URLISH); if (u) warns.push(`staging/localhost ref "${u[0]}" (${f})`);
}

// ── template sizes ─────────────────────────────────────────────────────────
// Skill HTML is generated by Claude at runtime, so leaner templates = faster, cheaper
// generation. Report every template's size and warn on any over the per-file budget.
const TEMPLATE_BUDGET = 10 * 1024; // bytes per skill template.html (current largest ≈ 8 KB)
const kb = (b) => (b / 1024).toFixed(1) + ' KB';
const templateSizes = tracked
  .filter((f) => /^(partner-managers|partners)\/skills\/[^/]+\/assets\/template\.html$/.test(f))
  .map((f) => { const s = read(f); return { skill: f.match(/skills\/([^/]+)\//)[1], bytes: Buffer.byteLength(s), lines: s.split('\n').length }; })
  .sort((a, b) => b.bytes - a.bytes);
const tplTotal = templateSizes.reduce((s, t) => s + t.bytes, 0);
const tplLines = templateSizes.reduce((s, t) => s + t.lines, 0);
const tplAvg = templateSizes.length ? tplTotal / templateSizes.length : 0;
const overBudget = templateSizes.filter((t) => t.bytes > TEMPLATE_BUDGET);
for (const t of overBudget) warns.push(`template "${t.skill}" is ${kb(t.bytes)} — over the ${kb(TEMPLATE_BUDGET)} per-template budget`);
const cssFile = tracked.find((f) => /^(partner-managers|partners)\/skills\/[^/]+\/assets\/styles\.css$/.test(f));
const cssBytes = cssFile ? Buffer.byteLength(read(cssFile)) : 0;
const largest = templateSizes[0] || { skill: '—', bytes: 0 };

// ── report (console + Markdown summary for the run / sticky PR comment) ──────
const ok = errors.length === 0;
const pct = (b) => Math.round((b / TEMPLATE_BUDGET) * 100) + '%';
const summaryMd = [
  '## EULER-skills quality gate',
  '',
  `${ok ? '✅ **PASS**' : '❌ **FAIL**'} — ${skillFiles.length} skills, ${tracked.length} files · ${errors.length} error(s) · ${warns.length} warning(s)`,
  '',
  '| Check | Result |',
  '|---|:--:|',
  ...checks.map((c) => `| ${c.name} | ${c.ok ? '✅' : '❌'} |`),
  '',
  `### Template sizes — budget ${kb(TEMPLATE_BUDGET)} each`,
  '| Skill | template.html | lines | of budget |',
  '|---|--:|--:|--:|',
  ...templateSizes.map((t) => `| ${t.skill} | ${kb(t.bytes)} | ${t.lines} | ${pct(t.bytes)} |`),
  `| **Total (${templateSizes.length})** | **${kb(tplTotal)}** | **${tplLines}** | — |`,
  '',
  `Shared \`styles.css\` ${kb(cssBytes)} · avg template ${kb(tplAvg)} · largest **${largest.skill}** ${kb(largest.bytes)}${overBudget.length ? ` · ⚠ ${overBudget.length} over budget` : ' · all within budget ✅'}`,
  errors.length ? `\n### Errors\n${errors.map((e) => '- ❌ ' + e.replace(/\n/g, '  \n  ')).join('\n')}` : '',
  warns.length ? `\n<details><summary>⚠ ${warns.length} warning(s)</summary>\n\n${warns.map((w) => '- ' + w).join('\n')}\n</details>` : '',
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMd); } catch { /* non-fatal */ }
  try { writeFileSync(join(root, 'qg-summary.md'), summaryMd); } catch { /* non-fatal */ } // consumed by the PR-comment step
}

// Console — compact + readable locally and in the pre-push hook
console.log(`\nEULER-skills quality gate — ${skillFiles.length} skills, ${tracked.length} files`);
for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
console.log(`  templates: ${kb(tplTotal)} total · avg ${kb(tplAvg)} · largest ${largest.skill} ${kb(largest.bytes)} · styles.css ${kb(cssBytes)}`);
if (warns.length) { console.log(`\n⚠ ${warns.length} warning(s):`); for (const w of warns) console.log('  - ' + w); }
if (errors.length) {
  console.error(`\n✗ ${errors.length} error(s):`);
  for (const e of errors) console.error('  ✗ ' + e);
  console.error('\nQuality gate FAILED.');
  process.exit(1);
}
console.log('\n✓ Quality gate PASSED (all error checks green).');
