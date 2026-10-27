#!/usr/bin/env bash
# Checks the squad-core agents: expected set, frontmatter, model aliases, read-only reviewers.
set -euo pipefail
cd "$(dirname "$0")/.."

dir=plugins/squad-core/agents
for a in triage product-analyst test-engineer implementer reviewer security-reviewer; do
  f="$dir/$a.md"
  test -f "$f" || { echo "agente mancante: $a"; exit 1; }
  grep -q "^name: $a$" "$f" || { echo "$a: name errato"; exit 1; }
  grep -q '^description: .\+' "$f" || { echo "$a: description mancante"; exit 1; }
  grep -qE '^model: (haiku|sonnet|opus)$' "$f" || { echo "$a: model deve essere un alias"; exit 1; }
  grep -q '^tools: .\+' "$f" || { echo "$a: tools mancanti"; exit 1; }
  grep -q 'AGENTS.md' "$f" || { echo "$a: deve rimandare a AGENTS.md"; exit 1; }
done
for a in reviewer security-reviewer; do
  if grep '^tools:' "$dir/$a.md" | grep -qE 'Edit|Write|NotebookEdit'; then
    echo "$a: i revisori non possono avere tool di scrittura"; exit 1
  fi
done
echo "agents OK"
