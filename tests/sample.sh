#!/usr/bin/env bash
# Sample project: generate it from the template, then run the same steps its CI gate (`verifica`) runs,
# on a code change and on a documentation-only change.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
g() { git -C "$p" -c user.email=t@t -c user.name=t "$@"; }
refuse() { if "$@"; then echo "atteso un fallimento: $*" >&2; exit 1; fi; }

# Stack package: the `verifica` gate on every combination of job results, the pre-push hook
# and the release tag, run for real on the generated project.
stack_checks() {
  python3 -c 'import yaml,sys; print(yaml.safe_load(open(sys.argv[1]))["jobs"]["verifica"]["steps"][0]["run"])' \
    "$p/.github/workflows/ci.yml" > "$work/gate.sh"
  gate() { STATICO="$1" E2E="$2" NEEDS_E2E="$3" bash "$work/gate.sh" >/dev/null 2>&1; }
  gate success success true
  gate success skipped false
  refuse gate success skipped true
  refuse gate success cancelled true
  refuse gate success failure true
  refuse gate failure skipped false
  refuse gate cancelled skipped ""
  refuse gate success failure false

  # pre-push: every step in order, build skipped without .env.local, stops at the first error
  g checkout -q main
  cat > "$p/package.json" <<'EOF'
{ "name": "s", "version": "1.0.0", "scripts": {
  "typecheck": "echo typecheck", "lint": "echo lint", "check:dup": "echo dup",
  "test:unit": "echo unit", "build": "echo build-ran" } }
EOF
  out="$(cd "$p" && sh .githooks/pre-push)"
  grep -q 'unit' <<< "$out" && grep -q 'Saltata: .env.local' <<< "$out"
  refuse grep -q 'build-ran' <<< "$out"
  printf 'NEXT_PUBLIC_SUPABASE_URL=http://x\nNEXT_PUBLIC_SUPABASE_ANON_KEY=k\n' > "$p/.env.local"
  out="$(cd "$p" && sh .githooks/pre-push)"; grep -q 'build-ran' <<< "$out"
  out="$(cd "$p" && SKIP_BUILD_PRE_PUSH=1 sh .githooks/pre-push)"; grep -q 'SKIP_BUILD_PRE_PUSH' <<< "$out"
  sed -i.bak 's/"echo lint"/"exit 3"/' "$p/package.json" && rm "$p/package.json.bak"
  refuse sh -c 'cd "$1" && sh .githooks/pre-push >/dev/null 2>&1' _ "$p"
  rm "$p/.env.local"

  # release tag: only when package.json changes version, or with --force
  g add package.json; g commit -q -m v1; v1="$(g rev-parse HEAD)"
  echo '// x' > "$p/x.js"; g add -A; g commit -q -m same; same="$(g rev-parse HEAD)"
  sed -i.bak 's/"1.0.0"/"1.1.0"/' "$p/package.json" && rm "$p/package.json.bak"; g commit -q -am bump; bump="$(g rev-parse HEAD)"
  test "$(cd "$p" && scripts/release-tag.sh "$v1" "$same")" = ""
  test "$(cd "$p" && scripts/release-tag.sh "$v1" "$same" --force)" = "v1.0.0"
  test "$(cd "$p" && scripts/release-tag.sh "$same" "$bump")" = "v1.1.0"
  test "$(cd "$p" && scripts/release-tag.sh "$v1^" "$v1")" = "v1.0.0"
}

for stack in none nextjs-supabase; do
  p="$work/sample-$stack"
  copier copy --defaults --quiet --data project_name=sample --data stack="$stack" \
    --data verify_fast="echo fast-ok" --data verify_full="echo full-ok" "$root/template" "$p" >/dev/null
  git init -q -b main "$p"; g add -A; g commit -q -m init

  # CI step "Full checks": the command comes from .claude/squad.json
  cmd="$(cd "$p" && node -p "const c=require('./.claude/squad.json'); c.verifyFull || c.verify || ''")"
  test "$cmd" = "echo full-ok"
  test "$(bash -c "$cmd")" = "full-ok"

  # CI step "Classify changes": code PR and documentation-only PR
  g checkout -q -b code; mkdir -p "$p/src"; echo 'x' > "$p/src/a.ts"; g add -A; g commit -q -m code
  test "$(cd "$p" && scripts/classify-changes.sh main)" = "code"
  g checkout -q main; g checkout -q -b docs; echo '# x' > "$p/docs.md"; mkdir -p "$p/docs"; echo y > "$p/docs/a.md"; g add -A; g commit -q -m docs
  test "$(cd "$p" && scripts/classify-changes.sh main)" = "docs"
  g checkout -q main; g checkout -q -b mixed; echo '# x' > "$p/docs.md"; echo 'x' > "$p/app.js"; g add -A; g commit -q -m mixed
  test "$(cd "$p" && scripts/classify-changes.sh main)" = "code"

  python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' "$p/.github/workflows/ci.yml"
  grep -q '^  verifica:' "$p/.github/workflows/ci.yml"
  if [ "$stack" = nextjs-supabase ]; then
    grep -q 'squad-nextjs-supabase@my-ai-squad' "$p/.claude/settings.json"
    stack_checks
  fi
done
echo "sample OK"
