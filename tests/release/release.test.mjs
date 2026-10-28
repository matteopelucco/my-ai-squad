// Tests for the release notes generator. Run: node --test "tests/*/*.test.mjs"
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupCommits, renderNotes } from '../../scripts/release-notes.mjs';

describe('groupCommits', () => {
  it('groups by type, drops merges, flags breaking changes', () => {
    const { groups, breaking } = groupCommits([
      'feat(core): add flow skills',
      'fix(ci): pass a glob',
      'Merge pull request #1 from x/y',
      'feat(template)!: rename an answer',
      'something unparsed',
      'chore: bump',
    ]);
    assert.deepEqual(groups.get('feat'), ['**core**: add flow skills', '**template**: rename an answer']);
    assert.deepEqual(groups.get('fix'), ['**ci**: pass a glob']);
    assert.deepEqual(groups.get('other'), ['something unparsed']);
    assert.deepEqual(breaking, ['**template**: rename an answer']);
  });
});

describe('renderNotes', () => {
  it('renders sections in a fixed order with the upgrade instructions', () => {
    const md = renderNotes('1.2.0', ['fix: b', 'feat: a']);
    assert.ok(md.startsWith('# my-ai-squad 1.2.0'));
    assert.ok(md.indexOf('## Novità') < md.indexOf('## Correzioni'));
    assert.match(md, /copier update/);
    assert.match(md, /plugin marketplace update my-ai-squad/);
  });

  it('says so when there is nothing to report', () => {
    assert.match(renderNotes('1.0.0', []), /Nessuna modifica rilevante/);
  });
});
