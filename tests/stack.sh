#!/usr/bin/env bash
# Checks the squad-nextjs-supabase stack package: plugin skills and hooks, and the files the
# template generates only with stack=nextjs-supabase (CI gate rules, Dependabot, release, pre-push).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail() { echo "$1" >&2; exit 1; }

# --- plugin ---
plugin=plugins/squad-nextjs-supabase
for s in supabase-security supabase-migration; do
  f="$plugin/skills/$s/SKILL.md"
  test -f "$f" || fail "skill mancante: $s"
  grep -q "^name: $s$" "$f" || fail "$s: name errato"
  grep -q '^description: .\+' "$f" || fail "$s: description mancante"
done
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$plugin/hooks/hooks.json"
grep -q 'guard-stack.mjs' "$plugin/hooks/hooks.json"

# no data or references of the projects the package was extracted from
if grep -rniE 'girasole|communio|sitescanner|bambini|maestr|genitor|rojac|turnstile' "$plugin" template; then
  fail "il pacchetto non deve citare progetti o dati di origine"
fi

# --- generated project ---
copier copy --defaults --quiet --data project_name=s --data stack=nextjs-supabase "$root/template" "$work/s" >/dev/null
p="$work/s"
yaml() { python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' "$1"; }
for f in ci release; do yaml "$p/.github/workflows/$f.yml"; done
yaml "$p/.github/dependabot.yml"
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$p/supabase/security-allowlist.json"
sh -n "$p/.githooks/pre-push"
bash -n "$p/scripts/release-tag.sh"
for f in rls-check grant-check supabase-query; do node --check "$p/scripts/$f.mjs"; done
test -x "$p/.githooks/pre-push" && test -x "$p/scripts/release-tag.sh"
grep -q '"testProjectRef": ""' "$p/.claude/squad.json"
grep -q '"squad-nextjs-supabase@my-ai-squad": true' "$p/.claude/settings.json"
grep -q '## Stack: Next.js + Supabase + Vercel' "$p/AGENTS.md"
test "$(wc -l < "$p/AGENTS.md")" -lt 60

# CI: statico -> e2e -> verifica, with the rules of the gate
python3 - "$p/.github/workflows/ci.yml" <<'EOF'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1]))
on = wf.get(True, wf.get("on"))
assert "paths" not in on["pull_request"] and "paths-ignore" not in on["pull_request"], "mai paths/paths-ignore"
jobs = wf["jobs"]
assert list(jobs) == ["statico", "e2e", "verifica"], list(jobs)
assert jobs["e2e"]["needs"] == "statico"
c = jobs["e2e"]["concurrency"]
assert c["cancel-in-progress"] is False and c["queue"] == "max" and c["group"].startswith("db-test-"), c
v = jobs["verifica"]
assert v["needs"] == ["statico", "e2e"] and v["if"] == "always()" and "name" not in v, v
assert all("timeout-minutes" in j for j in jobs.values()), "timeout su ogni job"
assert wf["permissions"] == {"contents": "read"}
steps = {s.get("name"): s for s in jobs["statico"]["steps"]}
assert "dependabot[bot]" in steps["Decide whether e2e is needed"]["run"]
# the service_role reaches only the step that prepares the e2e accounts
for s in jobs["e2e"]["steps"]:
    if "SUPABASE_SERVICE_ROLE_KEY" in str(s.get("env", {})):
        assert s["name"] == "Prepare e2e accounts", s["name"]
EOF

# Dependabot: groups, blocked majors of the stack
python3 - "$p/.github/dependabot.yml" <<'EOF'
import sys, yaml
npm = next(u for u in yaml.safe_load(open(sys.argv[1]))["updates"] if u["package-ecosystem"] == "npm")
assert set(npm["groups"]) == {"minor-and-patch", "major"}
blocked = {i["dependency-name"] for i in npm["ignore"]}
for dep in ["next", "react", "react-dom", "typescript", "eslint", "tailwindcss"]:
    assert dep in blocked, dep
EOF

# release only from package.json, write permission only on the job
python3 - "$p/.github/workflows/release.yml" <<'EOF'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1]))
on = wf.get(True, wf.get("on"))
assert on["push"]["paths"] == ["package.json"] and on["push"]["branches"] == ["main"]
assert wf["permissions"] == {}
assert wf["jobs"]["release"]["permissions"] == {"contents": "write"}
EOF

# core-only projects get none of it
copier copy --defaults --quiet --data project_name=c "$root/template" "$work/c" >/dev/null
for f in .githooks .github/dependabot.yml .github/workflows/release.yml scripts/rls-check.mjs supabase; do
  test ! -e "$work/c/$f" || fail "progetto senza stack: $f non deve esistere"
done
if grep -q 'supabase' "$work/c/.claude/squad.json" "$work/c/AGENTS.md"; then fail "progetto senza stack: riferimenti a supabase"; fi
echo "stack OK"
