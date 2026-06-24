#!/usr/bin/env node
// Asserts the shared canonical files have identical content (line endings
// normalized) across each repo-root canonical and its per-plugin/per-skill copies:
//   1. docs/partner-health-model.md  -> each consuming skill's references/ copy
//   2. core/report.css               -> each skill's assets/styles.css
// Run before `claude plugin validate .`. Exits 1 on any divergence.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Hash on normalized line endings so the guard flags real content drift, not
// CRLF-vs-LF differences introduced by git autocrlf / cp on different platforms.
const sha = (p) =>
  createHash('sha256').update(readFileSync(join(root, p), 'utf8').replace(/\r\n?/g, '\n')).digest('hex');

const MANAGER = 'partner-managers/skills';
const PARTNER = 'partners/skills';
const styles = (base, names) => names.map((n) => `${base}/${n}/assets/styles.css`);

const families = [
  {
    name: 'partner-health-model.md',
    canonical: 'docs/partner-health-model.md',
    copies: [
      'partner-managers/skills/generate-qbr/references/partner-health-model.md',
      'partner-managers/skills/portfolio-pulse/references/partner-health-model.md',
      'partners/skills/my-performance/references/partner-health-model.md',
    ],
  },
  {
    name: 'report.css',
    canonical: 'core/report.css',
    copies: [
      ...styles(MANAGER, ['generate-qbr', 'partner-briefing', 'portfolio-pulse', 'pending-approvals-triage']),
      ...styles(PARTNER, ['my-performance', 'my-onboarding', 'my-referrals', 'my-deals', 'submit-a-referral']),
    ],
  },
];

let failed = false;
for (const fam of families) {
  let ref;
  try {
    ref = sha(fam.canonical);
  } catch (e) {
    console.error(`FAIL [${fam.name}]: cannot read canonical ${fam.canonical}: ${e.message}`);
    failed = true;
    continue;
  }
  const bad = [];
  for (const c of fam.copies) {
    let h;
    try {
      h = sha(c);
    } catch (e) {
      bad.push(`${c} (missing: ${e.message})`);
      continue;
    }
    if (h !== ref) bad.push(`${c} (sha ${h.slice(0, 12)} != canonical ${ref.slice(0, 12)})`);
  }
  if (bad.length) {
    failed = true;
    console.error(`FAIL [${fam.name}]: copies out of sync with ${fam.canonical}:`);
    for (const b of bad) console.error('  - ' + b);
  } else {
    console.log(`OK: ${fam.name} in sync across ${fam.copies.length + 1} copies (sha ${ref.slice(0, 12)})`);
  }
}

if (failed) {
  console.error('\nFix: copy each canonical over its diverging copies, then re-run.');
  process.exit(1);
}
