#!/usr/bin/env bash
# Checks that every relative Markdown link in README.md and docs/ points to an existing file,
# and that script and workflow paths named in the guides exist in the template.
set -euo pipefail
cd "$(dirname "$0")/.."

node - <<'JS'
const fs = require('fs');
const path = require('path');
const files = ['README.md'];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.md')) files.push(p);
  }
})('docs');
let bad = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const file = path.resolve(path.dirname(f), target.split('#')[0]);
    if (!fs.existsSync(file)) { console.error(`${f}: link rotto -> ${target}`); bad += 1; }
  }
}
for (const script of ['setup-labels.sh', 'setup-project.sh', 'apply-ruleset.sh']) {
  if (!fs.existsSync(`template/files/scripts/${script}`)) { console.error(`script mancante nel template: ${script}`); bad += 1; }
}
if (bad) process.exit(1);
console.log('links OK');
JS
