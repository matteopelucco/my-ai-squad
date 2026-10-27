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

tests/template.sh
echo "OK"
