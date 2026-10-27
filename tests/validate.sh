#!/usr/bin/env bash
# Validates the marketplace, every plugin, and the Copier template.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

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
echo "OK"
