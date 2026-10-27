#!/usr/bin/env node
// Stop hook: runs the project's quick verification command (`verify` in
// .claude/squad.json) and sends Claude back to work while it fails. Without a
// declared command it does nothing.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readConfig } from './lib/config.mjs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
// Already sent back once for this stop: do not loop forever.
if (input.stop_hook_active) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const { verify } = readConfig(projectDir);
if (!verify) process.exit(0);

const run = spawnSync(verify, { cwd: projectDir, shell: true, encoding: 'utf8', timeout: 540_000 });
if (run.status === 0) process.exit(0);

const tail = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `Il controllo di verifica \`${verify}\` non passa (${run.error ? run.error.message : `exit ${run.status}`}). Correggi prima di concludere.\n\n${tail}`,
  }),
);
