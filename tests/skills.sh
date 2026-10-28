#!/usr/bin/env bash
# Checks the squad-core skills: expected set, frontmatter, side-effect skills not model-invocable,
# run-tasks bound to ADR-0004, and no stack or project references in the core.
set -euo pipefail
cd "$(dirname "$0")/.."

dir=plugins/squad-core/skills
for s in work-on-issue next-task run-tasks task-review prepare-pr owasp-check rebase-pr; do
  f="$dir/$s/SKILL.md"
  test -f "$f" || { echo "skill mancante: $s"; exit 1; }
  grep -q "^name: $s$" "$f" || { echo "$s: name errato"; exit 1; }
  grep -q '^description: .\+' "$f" || { echo "$s: description mancante"; exit 1; }
done
for s in next-task run-tasks prepare-pr rebase-pr; do
  grep -q '^disable-model-invocation: true$' "$dir/$s/SKILL.md" || { echo "$s: serve disable-model-invocation: true"; exit 1; }
done
f="$dir/run-tasks/SKILL.md"
grep -q 'ai-driven' "$f" && grep -q 'human-in-the-loop' "$f" || { echo "run-tasks: mancano le classi ai-driven/human-in-the-loop"; exit 1; }
test -f "$dir/run-tasks/budget.mjs" && grep -q 'budget.mjs' "$f" || { echo "run-tasks: manca la fase di budget"; exit 1; }
grep -q -- '--admin' "$f" || { echo "run-tasks: deve vietare --admin"; exit 1; }

if grep -rniE 'girasole|communio|sitescanner|supabase|next\.?js|vercel|playwright|\brls\b' plugins/squad-core/skills plugins/squad-core/agents; then
  echo "il nucleo non deve citare progetti o stack"; exit 1
fi
echo "skills OK"
