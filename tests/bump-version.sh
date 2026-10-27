#!/usr/bin/env bash
# Increments the patch version (or minor/major) in VERSION and in every manifest.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
part="${1:-patch}"

IFS=. read -r major minor patch < VERSION
case "$part" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
  *) echo "usage: $0 [major|minor|patch]" >&2; exit 2 ;;
esac
new="$major.$minor.$patch"

printf '%s\n' "$new" > VERSION
for f in .claude-plugin/marketplace.json plugins/*/.claude-plugin/plugin.json; do
  sed -i.bak -E "s/(\"version\": *\")[0-9]+\.[0-9]+\.[0-9]+\"/\1$new\"/" "$f" && rm "$f.bak"
done
echo "$new"
