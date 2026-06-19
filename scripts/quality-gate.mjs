#!/usr/bin/env node
// EULER-skills quality gate. Run before every push (the .githooks/pre-push hook does
// this automatically; CI re-runs it on PRs). Checks plugin/skill best practices +
// public-repo hygiene. ERRORS block (exit 1); WARNINGS are surfaced only.
//
//   node scripts/quality-gate.mjs
//
import { readFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const read = (p) => readFileSync(join(root, p), 'utf8');
const tracked = sh('git ls-files').split(/\r?\n/).filter(Boolean);

const errors = [];
const warns = [];
const SKILL_RE = /^(partner-managers|partners)\/skills\/([^/]+)\/SKILL\.md$/;
const skillFiles = tracked.filter((f) => SKILL_RE.test(f));
const skillDirs = [...new Set(skillFiles.map((f) => f.replace(/\/SKILL\.md$/, '')))];

// 1. Manifests valid (claude plugin validate) — skip with WARNING if the CLI is absent (e.g. CI)
let claudeOk = true;
try { sh('claude --version'); } catch { claudeOk = false; }
if (!claudeOk) {
  warns.push('`claude` CLI not available — skipped plugin-manifest validation (runs locally via the pre-push hook).');
} else {
  for (const p of ['.', './partner-managers', './partners']) {
    let out = '';
    try { out = sh(`claude plugin validate ${p}`); }
    catch (e) { out = (e.stdout || '').toString() + (e.stderr || '').toString(); }
    if (!/Validation passed/.test(out)) errors.push(`manifest invalid: ${p}\n${out.trim()}`);
  }
}

// 2. Canonical assets in sync
try { sh('node scripts/check-core-sync.mjs'); }
catch (e) { errors.push(`canonical sync failed:\n${(e.stdout || e.message || '').toString().trim()}`); }

// 3. Skill frontmatter: name (== folder, kebab-case) + description; no angle brackets in description
for (const f of skillFiles) {
  const folder = f.match(SKILL_RE)[2];
  const txt = read(f);
  const fm = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) { errors.push(`${f}: missing YAML frontmatter`); continue; }
  const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  const desc = (fm[1].match(/^description:\s*([\s\S]*?)$/m) || [])[1]?.trim();
  if (!name) errors.push(`${f}: frontmatter missing 'name'`);
  else if (name !== folder) errors.push(`${f}: name '${name}' != folder '${folder}'`);
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) errors.push(`${f}: name '${name}' not kebab-case`);
  if (!desc) errors.push(`${f}: frontmatter missing 'description'`);
  else if (/[<>]/.test(desc)) errors.push(`${f}: description contains angle bracket(s) — skill will silently fail to load`);
}

// 4. No legacy CSS tokens in shipped CSS-bearing files (templates, styles.css, examples) + core
const LEGACY = /--(brand|gray|error|warning|success|violet|cyan|pink|shadow)-/;
for (const f of tracked) {
  if (!/^(partner-managers|partners)\/skills\/[^/]+\/(assets\/(template\.html|styles\.css)|examples\/.+\.html)$/.test(f) && !/^core\/.+\.css$/.test(f)) continue;
  if (LEGACY.test(read(f))) errors.push(`${f}: contains legacy CSS token (must use canonical aliases --b6/--g5/…)`);
}

// 5. English-only in shipped content (no high-signal PT-BR function words)
const PT = /\b(n[ãa]o|voc[êe]s?|est[ãa]o?|ent[ãa]o|tamb[ée]m|porqu[êe]|isso|agora|pra|vc|deixar|nosso|fazer|criar|p[áa]gina|arquivo)\b/i;
const englishScope = tracked.filter((f) => /\.(md|html)$/.test(f) && !/^docs\//.test(f) && f !== 'README.md' ? true : /^(README|CONTRIBUTING)\.md$|^(partner-managers|partners)\/skills\/|^showcase\/index\.html$/.test(f));
for (const f of englishScope) {
  const m = read(f).match(PT);
  if (m) errors.push(`${f}: possible PT-BR text ("${m[0]}") — shipped content must be English`);
}

// 6. No real Bubble IDs (allow the all-zeros placeholder)
const BUBBLE = /\b(\d{10,})x(\d{6,})\b/g;
for (const f of tracked.filter((f) => /SKILL\.md$|examples\/.+\.(md|html)$/.test(f) && /^(partner-managers|partners)\//.test(f))) {
  for (const m of read(f).matchAll(BUBBLE)) if (!/^0+$/.test(m[2])) errors.push(`${f}: real-looking Bubble ID '${m[0]}' — sanitize to …x000…`);
}

// 7. No secrets
const SECRET = /(sk-[a-z0-9]{16,}|bearer\s+[a-z0-9._-]{12,}|api[_-]?key\s*[:=]\s*['"]?[a-z0-9]{12,}|password\s*[:=]\s*['"]?\S{6,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
for (const f of tracked) {
  if (!/\.(md|html|json|mjs|js|css|txt|ya?ml|sh)$/.test(f)) continue;
  const m = read(f).match(SECRET);
  if (m) errors.push(`${f}: possible secret ("${m[0].slice(0, 24)}…")`);
}

// 8. HTML lightweight — skill templates + example renders: no <script>, <img>, base64
for (const f of tracked.filter((f) => /^(partner-managers|partners)\/skills\/[^/]+\/(assets\/template\.html|examples\/.+\.html)$/.test(f))) {
  const t = read(f);
  if (/<script[\s>]/i.test(t)) errors.push(`${f}: contains <script> (skill HTML must be JS-free)`);
  if (/<img[\s>]/i.test(t)) errors.push(`${f}: contains <img> (use the text wordmark, no images)`);
  if (/data:[^;'"]*;base64,/i.test(t)) errors.push(`${f}: contains a base64 data-URI (not allowed)`);
}

// 9. Each skill has >=1 example
for (const d of skillDirs) {
  const ex = join(root, d, 'examples');
  if (!existsSync(ex) || readdirSync(ex).filter((n) => !n.startsWith('.')).length === 0) errors.push(`${d}: no example under examples/`);
}

// 10. No internal dev docs tracked
const devdocs = tracked.filter((f) => /^docs\/(plans|specs)\//.test(f) || f === 'PLAN-account-aware-skills.md');
if (devdocs.length) errors.push(`internal dev docs are tracked (should be gitignored): ${devdocs.join(', ')}`);

// WARNINGS — non-eulerapp emails, staging/localhost URLs
const EMAIL = /[a-z0-9._%+-]+@(?!eulerapp\.com\b)[a-z0-9.-]+\.[a-z]{2,}/gi;
const URLISH = /(https?:\/\/[^\s"'<)]*staging[^\s"'<)]*|staging\.[a-z0-9.-]+|localhost(:\d+)?|127\.0\.0\.1)/i;
const seenEmail = new Set();
for (const f of tracked) {
  if (!/\.(md|html|json|mjs|js|css|txt|ya?ml)$/.test(f)) continue;
  if (/^(scripts|\.github)\//.test(f)) continue; // tooling holds pattern literals (localhost, sk-, …)
  const t = read(f);
  for (const e of t.match(EMAIL) || []) { const k = e.toLowerCase(); if (!seenEmail.has(k)) { seenEmail.add(k); warns.push(`non-eulerapp email "${e}" (${f}) — confirm fictional/sample`); } }
  const u = t.match(URLISH); if (u) warns.push(`staging/localhost ref "${u[0]}" (${f})`);
}

// Report — console + GitHub Actions job summary (renders on the PR's run page)
const CHECKS = 'manifests (`claude plugin validate`) · canonical sync · skill frontmatter (no `<>` in description) · no legacy CSS tokens · English-only · no Bubble IDs / secrets · lightweight HTML · examples present · no dev docs tracked';
const status = errors.length ? '✗ FAILED' : '✓ PASSED';
const summaryMd =
  `## EULER-skills quality gate\n\n` +
  `**${status}** · ${errors.length} error(s) · ${warns.length} warning(s) · ${skillFiles.length} skills, ${tracked.length} tracked files\n\n` +
  `**Checks run:** ${CHECKS}\n` +
  (errors.length ? `\n### Errors\n${errors.map((e) => '- ✗ ' + e.replace(/\n/g, '  \n  ')).join('\n')}\n` : '') +
  (warns.length ? `\n<details><summary>⚠ ${warns.length} warning(s)</summary>\n\n${warns.map((w) => '- ' + w).join('\n')}\n</details>\n` : '');
if (process.env.GITHUB_STEP_SUMMARY) {
  try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMd); } catch { /* non-fatal */ }
}

console.log(`\nEULER-skills quality gate — ${skillFiles.length} skills, ${tracked.length} tracked files\n`);
if (warns.length) { console.log(`⚠ ${warns.length} warning(s):`); for (const w of warns) console.log('  - ' + w); console.log(''); }
if (errors.length) {
  console.error(`✗ ${errors.length} error(s):`);
  for (const e of errors) console.error('  ✗ ' + e);
  console.error('\nQuality gate FAILED.');
  process.exit(1);
}
console.log('✓ Quality gate PASSED (all error checks green).');
