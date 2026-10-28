#!/usr/bin/env bash
# Generates projects from the Copier template and checks them; then checks that
# `copier update` after a template change produces only the expected diff.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

gen() { # name, extra --data args...
  local name="$1"; shift
  copier copy --defaults --quiet --data project_name="$name" "$@" "$root/template" "$work/$name" >/dev/null
}
json() { python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$1"; }
yaml() { python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' "$1"; }

# --- default project (core only, human merge) ---
gen sample
p="$work/sample"
test -f "$p/AGENTS.md"
test "$(cat "$p/CLAUDE.md")" = "@AGENTS.md"
test "$(wc -l < "$p/AGENTS.md")" -lt 60
json "$p/.claude/settings.json"; json "$p/.claude/squad.json"
grep -q '"squad-core@my-ai-squad": true' "$p/.claude/settings.json"
! grep -q 'nextjs-supabase' "$p/.claude/settings.json"
grep -q '"Read(./.env.\*)"' "$p/.claude/settings.json"
grep -q '"extraKnownMarketplaces"' "$p/.claude/settings.json"
grep -q '"mergeMode": "human"' "$p/.claude/squad.json"
test -f "$p/.copier-answers.yml"
for f in feature bug chore; do test -f "$p/.github/ISSUE_TEMPLATE/$f.md"; done
test -f "$p/.github/pull_request_template.md"
bash -n "$p/scripts/setup-labels.sh"; bash -n "$p/scripts/setup-project.sh"
test -x "$p/scripts/setup-labels.sh"

# --- ruleset of main ---
python3 - "$p/.github/rulesets/main.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
types = {x["type"] for x in r["rules"]}
assert {"deletion", "non_fast_forward", "pull_request", "required_status_checks"} <= types, types
checks = [c["context"] for x in r["rules"] if x["type"] == "required_status_checks" for c in x["parameters"]["required_status_checks"]]
assert checks == ["verifica"], checks
assert r["bypass_actors"] == [] and r["enforcement"] == "active"
PY
bash -n "$p/scripts/apply-ruleset.sh"

# --- variants ---
gen full --data stack=nextjs-supabase --data merge_mode=ai-driven --data visibility=private \
  --data docs_language=en --data verify_fast="npm run check" --data verify_full="npm run build"
f="$work/full"
json "$f/.claude/settings.json"; json "$f/.claude/squad.json"
grep -q '"squad-nextjs-supabase@my-ai-squad": true' "$f/.claude/settings.json"
grep -q '"verify": "npm run check"' "$f/.claude/squad.json"
grep -q '"mergeMode": "ai-driven"' "$f/.claude/squad.json"
grep -q 'npm run build' "$f/AGENTS.md"
grep -q 'ai-driven' "$f/AGENTS.md"

# --- agentic workflows (ADR-0011, ADR-0012) ---
w="$p/.github/workflows/squad-triage.yml"
yaml "$w"; yaml "$p/.github/workflows/squad-close-issue.yml"
grep -q 'author_association' "$w"
grep -q 'timeout-minutes' "$w"
grep -q -- '--max-turns' "$w"
grep -q -- '--allowedTools' "$w"
grep -q 'ANTHROPIC_API_KEY' "$w" && grep -q 'CLAUDE_CODE_OAUTH_TOKEN' "$w"
grep -qE '^permissions:' "$w"
! grep -qE -- '--model (claude-|[a-z]+-[0-9])' "$w"   # aliases only
# no user-controlled text in the workflows: only the issue number may be interpolated
! grep -rnE 'github\.event\.(issue|comment|pull_request)\.(title|body)|head_ref' "$p/.github/workflows"
! grep -q 'pull_request_target' "$w"

# --- copier update produces only the expected diff ---
tpl="$work/tpl"; cp -R "$root/template" "$tpl"
git -C "$tpl" init -q && git -C "$tpl" add -A
git -C "$tpl" -c user.email=t@t -c user.name=t commit -q -m v1 && git -C "$tpl" tag v1.0.0
upd="$work/upd"
copier copy --defaults --quiet --vcs-ref v1.0.0 --data project_name=upd "$tpl" "$upd" >/dev/null
git -C "$upd" init -q && git -C "$upd" add -A
git -C "$upd" -c user.email=t@t -c user.name=t commit -q -m init
printf '\n- Nuova regola di prova.\n' >> "$tpl/files/AGENTS.md.jinja"
git -C "$tpl" add -A && git -C "$tpl" -c user.email=t@t -c user.name=t commit -q -m v2 && git -C "$tpl" tag v1.1.0
( cd "$upd" && copier update --defaults --quiet --vcs-ref v1.1.0 >/dev/null )
changed="$(git -C "$upd" status --porcelain | sed 's/^...//' | sort | tr '\n' ' ')"
test "$changed" = ".copier-answers.yml AGENTS.md " || { echo "diff inatteso dopo copier update: $changed"; exit 1; }
grep -q 'Nuova regola di prova' "$upd/AGENTS.md"
echo "template OK"
