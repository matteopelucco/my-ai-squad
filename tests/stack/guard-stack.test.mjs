// Tests for the squad-nextjs-supabase guard hook. Run: node --test "tests/*/*.test.mjs"
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { evaluateStackCommand } from '../../plugins/squad-nextjs-supabase/hooks/lib/rules.mjs';

const hook = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../plugins/squad-nextjs-supabase/hooks/guard-stack.mjs');
const test = { testProjectRef: 'testref123' };

describe('evaluateStackCommand', () => {
  const denied = [
    'supabase db push',
    'supabase db push --project-ref prodref999',
    'npx supabase db push --project-ref prodref999 --dry-run',
    'supabase db reset --linked',
    'supabase db reset --linked --project-ref prodref999 --yes',
    'supabase link --project-ref prodref999',
    'supabase migration repair --status applied 0001',
    'supabase db push --db-url postgres://u:p@h/db',
    'supabase secrets set X=1',
    'supabase functions deploy hello',
    'supabase projects delete testref123',
    'vercel --prod',
    'npx vercel deploy --prod',
    'vercel promote https://x.vercel.app',
    'vercel rollback',
    'vercel remove my-app',
    'npm test && supabase db push --project-ref prodref999',
  ];
  for (const command of denied) {
    it(`denies: ${command}`, () => assert.equal(evaluateStackCommand(command, test)?.decision, 'deny'));
  }

  it('asks for Vercel environment changes', () => {
    assert.equal(evaluateStackCommand('vercel env pull .env.local', test)?.decision, 'ask');
    assert.equal(evaluateStackCommand('vercel env rm KEY production', test)?.decision, 'ask');
  });

  const allowed = [
    'supabase start',
    'supabase db reset',
    'supabase test db',
    'supabase migration new add_items',
    'supabase db push --project-ref testref123',
    'supabase db reset --linked --project-ref testref123 --yes',
    'supabase link --project-ref=testref123',
    'vercel deploy',
    'npm run build',
  ];
  for (const command of allowed) {
    it(`allows: ${command}`, () => assert.equal(evaluateStackCommand(command, test), null));
  }

  it('denies every remote operation when the test project is not configured', () => {
    assert.equal(evaluateStackCommand('supabase db push --project-ref testref123')?.decision, 'deny');
    assert.equal(evaluateStackCommand('supabase db reset'), null);
  });
});

describe('guard-stack.mjs', () => {
  const run = (projectDir, command, env = {}) =>
    spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ tool_input: { command }, cwd: projectDir }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, SUPABASE_TEST_PROJECT_REF: '', ...env },
    });

  it('reads the test project from .claude/squad.json', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'guard-stack-'));
    mkdirSync(path.join(dir, '.claude'));
    writeFileSync(path.join(dir, '.claude', 'squad.json'), JSON.stringify({ supabase: { testProjectRef: 'testref123' } }));
    assert.equal(run(dir, 'supabase db push --project-ref testref123').stdout, '');
    const out = JSON.parse(run(dir, 'supabase db push --project-ref prodref999').stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  });

  it('prefers SUPABASE_TEST_PROJECT_REF and ignores malformed input', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'guard-stack-'));
    assert.equal(run(dir, 'supabase db push --project-ref envref', { SUPABASE_TEST_PROJECT_REF: 'envref' }).stdout, '');
    const res = spawnSync(process.execPath, [hook], { input: 'not json', encoding: 'utf8' });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  });
});
