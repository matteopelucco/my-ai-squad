#!/usr/bin/env bash
# Checks that VERSION matches the marketplace and every plugin manifest.
# With --bumped <ref>, also checks that VERSION differs from the one at <ref>.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
version="$(tr -d '[:space:]' < VERSION)"

check() {
  local actual
  actual="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(eval(sys.argv[2]))' "$1" "$2")"
  [ "$actual" = "$version" ] || { echo "$1: $actual != $version" >&2; exit 1; }
}

check .claude-plugin/marketplace.json 'd["metadata"]["version"]'
for manifest in plugins/*/.claude-plugin/plugin.json; do
  check "$manifest" 'd["version"]'
done

if [ "${1:-}" = "--bumped" ]; then
  base="$(git show "$2:VERSION" 2>/dev/null | tr -d '[:space:]' || true)"
  [ "$base" != "$version" ] || { echo "VERSION non incrementata (ancora $version)" >&2; exit 1; }
fi
echo "version OK ($version)"
