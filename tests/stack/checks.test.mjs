// Tests for the pure logic of the stack template's rls-check and grant-check.
// The template files have conditional names, so they are copied under their real names first.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../template/files/scripts');
const work = mkdtempSync(path.join(os.tmpdir(), 'stack-checks-'));
for (const name of ['supabase-query.mjs', 'rls-check.mjs', 'grant-check.mjs']) {
  copyFileSync(path.join(scripts, `{% if stack == 'nextjs-supabase' %}${name}{% endif %}`), path.join(work, name));
}
const load = (name) => import(pathToFileURL(path.join(work, name)).href);
const rls = await load('rls-check.mjs');
const grant = await load('grant-check.mjs');

const obj = (name, relkind, rls, grantees, reloptions = []) => ({ name, relkind, rls, grantees, reloptions });

describe('rls-check', () => {
  it('flags exposed tables with RLS disabled, unless allow-listed', () => {
    const objects = [obj('a', 'r', false, ['authenticated']), obj('b', 'r', true, ['anon']), obj('c', 'r', false, []), obj('d', 'p', false, ['anon'])];
    assert.deepEqual(rls.findTablesWithoutRls(objects).map((o) => o.name), ['a', 'd']);
    assert.deepEqual(rls.findTablesWithoutRls(objects, ['a']).map((o) => o.name), ['d']);
  });

  it('flags views without security_invoker, materialized views and foreign tables', () => {
    const objects = [
      obj('v_ok', 'v', false, ['authenticated'], ['security_invoker=true']),
      obj('v_bad', 'v', false, ['authenticated']),
      obj('v_off', 'v', false, ['anon'], ['security_invoker=on', 'security_invoker=false']),
      obj('m', 'm', false, ['anon']),
      obj('f', 'f', false, ['authenticated']),
      obj('m_private', 'm', false, []),
    ];
    assert.deepEqual(rls.findExposedWithoutRls(objects).map((o) => o.name), ['v_bad', 'v_off', 'm', 'f']);
  });

  it('normalises the API response fail-closed', () => {
    const ok = rls.normalizeRows([{ name: 't', relkind: 'r', rls: true, grantees: '{anon,authenticated}', reloptions: null }]);
    assert.deepEqual(ok.objects[0].grantees, ['anon', 'authenticated']);
    assert.ok('error' in rls.normalizeRows({}));
    assert.ok('error' in rls.normalizeRows([{ name: 't', relkind: 'x', rls: true, grantees: [] }]));
    assert.ok('error' in rls.normalizeRows([{ name: 't', relkind: 'r', rls: 'yes', grantees: [] }]));
    assert.ok('error' in rls.normalizeRows([{ name: 't', relkind: 'r', rls: true, grantees: 3 }]));
  });

  it('refuses an empty schema', () => {
    assert.ok(rls.guard([]));
    assert.ok(rls.guard([obj('v', 'v', false, [])]));
    assert.equal(rls.guard([obj('t', 'r', true, [])]), null);
  });
});

describe('grant-check', () => {
  const source = `import { createAdminClient } from '@/lib/supabase/admin';

export async function listItems(supabase) {
  return supabase.from('items').select('*');
}

// grant-check: service_role
export async function nightly(client) {
  await client.from('reports').insert({});
}

export async function purge() {
  const admin = createAdminClient();
  await admin.from('logs').delete().eq('id', 1);
}

export const save = async (db: SupabaseClient) => {
  await db.from('notes').upsert({});
};
// supabase.from('ignored').select()
const x = Array.from(new Set());
`;

  it('extracts role, table and privilege for each query', () => {
    const got = grant.extractRequests('lib/a.ts', source).map((r) => `${r.role} ${r.privilege} ${r.table}`);
    assert.deepEqual(got, [
      'authenticated SELECT items',
      'service_role INSERT reports',
      'service_role DELETE logs',
      'authenticated INSERT notes',
      'authenticated UPDATE notes',
      'service_role INSERT notes',
      'service_role UPDATE notes',
    ]);
  });

  it('reports only missing grants, once per file', () => {
    const requests = [
      { file: 'a.ts', role: 'authenticated', table: 'items', privilege: 'SELECT' },
      { file: 'a.ts', role: 'authenticated', table: 'items', privilege: 'SELECT' },
      { file: 'a.ts', role: 'authenticated', table: 'items', privilege: 'UPDATE' },
    ];
    const grants = [{ grantee: 'authenticated', table_name: 'items', privilege_type: 'SELECT' }];
    assert.deepEqual(grant.missingGrants(requests, grants).map((m) => m.privilege), ['UPDATE']);
    assert.match(grant.formatMissing(grant.missingGrants(requests, grants)), /UPDATE su public\.items per authenticated/);
  });
});
