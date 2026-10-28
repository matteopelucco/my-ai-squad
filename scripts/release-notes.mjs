#!/usr/bin/env node
// Builds the release notes of the framework from Conventional Commit subjects.
// Usage: node scripts/release-notes.mjs <version> [<previous-tag>]   (reads git log; prints Markdown)

import { execFileSync } from 'node:child_process';

const SECTIONS = [
  ['feat', 'Novità'],
  ['fix', 'Correzioni'],
  ['perf', 'Prestazioni'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentazione'],
  ['test', 'Test'],
  ['ci', 'CI'],
  ['chore', 'Manutenzione'],
];

/**
 * Groups commit subjects by Conventional Commit type; merge commits and unparseable subjects
 * go to "Altro". Breaking changes (`!` or `BREAKING CHANGE`) are listed first.
 * @param {string[]} subjects
 */
export function groupCommits(subjects) {
  const groups = new Map();
  const breaking = [];
  const add = (key, line) => groups.set(key, [...(groups.get(key) ?? []), line]);
  for (const subject of subjects) {
    if (/^Merge (pull request|branch)/i.test(subject)) continue;
    const m = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/.exec(subject);
    if (!m) {
      add('other', subject);
      continue;
    }
    const [, type, scope, bang, text] = m;
    const line = scope ? `**${scope}**: ${text}` : text;
    if (bang) breaking.push(line);
    add(SECTIONS.some(([t]) => t === type) ? type : 'other', line);
  }
  return { groups, breaking };
}

/** @param {string} version @param {string[]} subjects */
export function renderNotes(version, subjects) {
  const { groups, breaking } = groupCommits(subjects);
  const out = [`# my-ai-squad ${version}`, ''];
  if (breaking.length) out.push('## Cambiamenti incompatibili', '', ...breaking.map((l) => `- ${l}`), '');
  for (const [type, title] of [...SECTIONS, ['other', 'Altro']]) {
    const lines = groups.get(type);
    if (lines?.length) out.push(`## ${title}`, '', ...lines.map((l) => `- ${l}`), '');
  }
  if (out.length === 2) out.push('Nessuna modifica rilevante.', '');
  out.push(
    '## Come aggiornare',
    '',
    '- **Plugin**: si aggiornano all\'avvio di Claude Code se l\'aggiornamento automatico del marketplace è attivo, altrimenti con `/plugin marketplace update my-ai-squad`.',
    '- **File di progetto**: `copier update` propone le novità del template come diff da rivedere in una PR.',
    '- Dettagli e conflitti: [guida all\'adozione e all\'aggiornamento](docs/guides/adozione.md#aggiornare-un-progetto).',
    '',
  );
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [version, previous] = process.argv.slice(2);
  if (!version) {
    process.stderr.write('usage: release-notes.mjs <version> [<previous-tag>]\n');
    process.exit(2);
  }
  const range = previous ? `${previous}..HEAD` : 'HEAD';
  const log = execFileSync('git', ['log', '--no-merges', '--format=%s', range], { encoding: 'utf8' });
  process.stdout.write(renderNotes(version, log.split('\n').filter(Boolean)));
}
