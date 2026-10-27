#!/usr/bin/env bash
# Validates the marketplace, every plugin, and the Copier template.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

tests/version.sh
tests/agents.sh
tests/skills.sh
node --test "tests/hooks/*.test.mjs"
claude plugin validate --strict .
for plugin in plugins/*/; do
  claude plugin validate --strict "$plugin"
done

out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
copier copy --defaults --data project_name=sample "$root/template" "$out/sample"
test -f "$out/sample/AGENTS.md"
grep -q '^# AGENTS.md — sample$' "$out/sample/AGENTS.md"
test "$(cat "$out/sample/CLAUDE.md")" = "@AGENTS.md"
grep -q '"Read(./.env.\*)"' "$out/sample/.claude/settings.json"
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$out/sample/.claude/squad.json"
echo "OK"
