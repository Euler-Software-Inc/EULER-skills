#!/usr/bin/env node
// Asserts the shared partner-health-model.md has identical content (line endings
// normalized) across the canonical repo-root copy and each plugin's docs/ copy.
// Run before `claude plugin validate .`. Exits 1 on any divergence.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonical = 'docs/partner-health-model.md';
const copies = [
  'partner-managers/docs/partner-health-model.md',
  'partners/docs/partner-health-model.md',
];

// Hash on normalized line endings so the guard flags real content drift, not
// CRLF-vs-LF differences introduced by git autocrlf / cp on different platforms.
const sha = (p) =>
  createHash('sha256').update(readFileSync(join(root, p), 'utf8').replace(/\r\n?/g, '\n')).digest('hex');

let ref;
try {
  ref = sha(canonical);
} catch (e) {
  console.error(`FAIL: cannot read canonical ${canonical}: ${e.message}`);
  process.exit(1);
}

const bad = [];
for (const c of copies) {
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
  console.error('FAIL: partner-health-model.md copies out of sync with canonical:');
  for (const b of bad) console.error('  - ' + b);
  console.error(`\nCanonical: ${canonical} (sha ${ref.slice(0, 12)})`);
  console.error('Fix: copy the canonical over each diverging file, then re-run.');
  process.exit(1);
}

console.log(`OK: partner-health-model.md in sync across ${copies.length + 1} copies (sha ${ref.slice(0, 12)})`);
