// Tests for the squad-core guard hooks. Run: node --test tests/hooks/
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { mergeAllowed } from '../../plugins/squad-core/hooks/lib/github.mjs';
import { evaluateCommand, evaluateWrite, isAiDriven, mergeTargets } from '../../plugins/squad-core/hooks/lib/rules.mjs';

const hooks = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../plugins/squad-core/hooks');
const branch = { branch: 'feat/4-x' };

describe('evaluateCommand', () => {
  const denied = [
    'gh pr merge 12 --squash',
    'gh pr merge 12 --admin',
    'git push --force origin feat/2-setup',
    'git push -f',
    'git push origin main',
    'git push origin HEAD:main',
    'git commit -m "x" --no-verify',
    'git push --no-verify',
    'gh api -X PUT repos/o/r/branches/main/protection',
    'gh api repos/o/r/rulesets --method POST -f name=x',
    'gh repo delete o/r --yes',
    'rm -rf /',
    'rm -rf ~',
    'git add . && git push origin main',
  ];
  for (const command of denied) {
    it(`denies: ${command}`, () => assert.equal(evaluateCommand(command, branch)?.decision, 'deny'));
  }

  const asked = [
    'git push --force-with-lease origin feat/2-setup',
    'gh secret set API_KEY',
    'gh repo edit --visibility private',
    'git reset --hard HEAD~1',
    'git clean -fdx',
  ];
  for (const command of asked) {
    it(`asks: ${command}`, () => assert.equal(evaluateCommand(command, branch)?.decision, 'ask'));
  }

  const allowed = [
    'git push -u origin chore/1-bootstrap',
    'git push origin feat/12-main-menu',
    'git commit -m "feat: add lock (#12)"',
    'gh pr create --base main --title x',
    'gh api repos/o/r/branches/main/protection',
    'npm run verify',
    'ls -la',
  ];
  for (const command of allowed) {
    it(`allows: ${command}`, () => assert.equal(evaluateCommand(command, branch), null));
  }

  it('allows a merge only when mergeAllowed is true, and never with --admin', () => {
    assert.equal(evaluateCommand('gh pr merge 5 --squash', { ...branch, mergeAllowed: true }), null);
    assert.equal(evaluateCommand('gh pr merge 5 --squash', { ...branch, mergeAllowed: false })?.decision, 'deny');
    assert.equal(evaluateCommand('gh pr merge 5 --admin', { ...branch, mergeAllowed: true })?.decision, 'deny');
  });

  it('denies commit and bare push on main', () => {
    assert.equal(evaluateCommand('git commit -m "x"', { branch: 'main' })?.decision, 'deny');
    assert.equal(evaluateCommand('git push', { branch: 'main' })?.decision, 'deny');
    assert.equal(evaluateCommand('git push -u origin', { branch: 'main' })?.decision, 'deny');
  });

  it('does not match across segments', () => {
    assert.equal(evaluateCommand('git push -u origin feat/1-a && gh pr create --base main', branch), null);
  });
});

describe('mergeTargets', () => {
  it('extracts PR references', () => {
    assert.deepEqual(mergeTargets('gh pr merge 12 --squash'), ['12']);
    assert.deepEqual(mergeTargets('gh pr merge --squash --body "x" 7'), ['7']);
    assert.deepEqual(mergeTargets('gh pr merge --auto'), ['']);
    assert.deepEqual(mergeTargets('git status && gh pr merge 3; gh pr merge 4'), ['3', '4']);
    assert.deepEqual(mergeTargets('gh pr view 3'), []);
  });
});

describe('isAiDriven / mergeAllowed', () => {
  it('requires an ai-driven issue and no human-in-the-loop one', () => {
    assert.equal(isAiDriven([['ai-driven', 'area:core']]), true);
    assert.equal(isAiDriven([['ai-driven'], ['human-in-the-loop']]), false);
    assert.equal(isAiDriven([['type:feature']]), false);
    assert.equal(isAiDriven([]), false);
  });

  const fake = (labels) => (args) =>
    args[0] === 'pr'
      ? JSON.stringify({ closingIssuesReferences: [{ number: 9 }] })
      : JSON.stringify({ labels: labels.map((name) => ({ name })) });

  it('looks the labels up through gh', () => {
    assert.equal(mergeAllowed(['5'], '.', fake(['ai-driven'])), true);
    assert.equal(mergeAllowed(['5'], '.', fake(['human-in-the-loop'])), false);
    assert.equal(mergeAllowed([], '.', fake(['ai-driven'])), false);
  });

  it('fails closed when gh fails', () => {
    assert.equal(mergeAllowed(['5'], '.', () => { throw new Error('boom'); }), false);
  });
});

describe('evaluateWrite', () => {
  const scopes = { docs: ['docs/', 'README.md'] };
  const project = path.resolve('/proj');
  it('allows files in scope', () => {
    assert.equal(evaluateWrite(scopes, 'docs', 'docs/a/b.md', project), null);
    assert.equal(evaluateWrite(scopes, 'docs', 'README.md', project), null);
    assert.equal(evaluateWrite(scopes, 'docs', path.join(project, 'docs/x.md'), project), null);
  });
  it('denies files out of scope, traversal and unknown profiles', () => {
    assert.equal(evaluateWrite(scopes, 'docs', 'src/a.ts', project)?.decision, 'deny');
    assert.equal(evaluateWrite(scopes, 'docs', 'docs/../src/a.ts', project)?.decision, 'deny');
    assert.equal(evaluateWrite(scopes, 'docs', '/etc/passwd', project)?.decision, 'deny');
    assert.equal(evaluateWrite(scopes, 'nope', 'docs/a.md', project)?.decision, 'deny');
  });
  it('allows extra roots', () => {
    assert.equal(evaluateWrite(scopes, 'docs', path.join(os.tmpdir(), 'x'), project, [os.tmpdir()]), null);
  });
});

function runHook(script, input, { env = {}, args = [], cwd } = {}) {
  return spawnSync('node', [path.join(hooks, script), ...args], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...env },
  });
}

describe('hook scripts', () => {
  const project = mkdtempSync(path.join(os.tmpdir(), 'squad-hooks-'));
  mkdirSync(path.join(project, '.claude'));

  it('guard-commands emits a deny decision', () => {
    const run = runHook('guard-commands.mjs', { tool_input: { command: 'git push --force' }, cwd: project });
    assert.equal(JSON.parse(run.stdout).hookSpecificOutput.permissionDecision, 'deny');
  });

  it('guard-commands is silent for harmless commands and bad input', () => {
    assert.equal(runHook('guard-commands.mjs', { tool_input: { command: 'ls' }, cwd: project }).stdout, '');
    assert.equal(spawnSync('node', [path.join(hooks, 'guard-commands.mjs')], { input: 'not json' }).status, 0);
  });

  it('guard-paths blocks out-of-scope writes with exit 2', () => {
    writeFileSync(path.join(project, '.claude', 'squad.json'), JSON.stringify({ writeScopes: { docs: ['docs/'] } }));
    // The OS temp dir is always writable, and the project lives in it: point it elsewhere.
    const env = { CLAUDE_PROJECT_DIR: project, TMPDIR: path.join(project, '..', 'elsewhere') };
    assert.equal(runHook('guard-paths.mjs', { tool_input: { file_path: 'src/a.ts' } }, { env, args: ['docs'] }).status, 2);
    assert.equal(runHook('guard-paths.mjs', { tool_input: { file_path: 'docs/a.md' } }, { env, args: ['docs'] }).status, 0);
  });

  it('stop-verify does nothing without a verify command', () => {
    writeFileSync(path.join(project, '.claude', 'squad.json'), '{}');
    const run = runHook('stop-verify.mjs', { cwd: project }, { env: { CLAUDE_PROJECT_DIR: project } });
    assert.equal(run.status, 0);
    assert.equal(run.stdout, '');
  });

  it('stop-verify blocks while verify fails and lets go when it passes or already active', () => {
    const env = { CLAUDE_PROJECT_DIR: project };
    writeFileSync(path.join(project, '.claude', 'squad.json'), JSON.stringify({ verify: 'echo broken >&2; exit 1' }));
    const failing = runHook('stop-verify.mjs', { cwd: project }, { env });
    const out = JSON.parse(failing.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /broken/);
    assert.equal(runHook('stop-verify.mjs', { cwd: project, stop_hook_active: true }, { env }).stdout, '');
    writeFileSync(path.join(project, '.claude', 'squad.json'), JSON.stringify({ verify: 'true' }));
    assert.equal(runHook('stop-verify.mjs', { cwd: project }, { env }).stdout, '');
  });
});
