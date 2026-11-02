#!/usr/bin/env node
// Stop hook: while the CI of the current branch's PR is running or has failed on the pushed
// commit, sends Claude back once, so that a pushed PR is not left unwatched. Silent on main,
// without a PR or checks, without `gh`, or with `"waitForCi": false` in .claude/squad.json.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readConfig } from './lib/config.mjs';
import { currentPr } from './lib/github.mjs';
import { ciStopReason } from './lib/rules.mjs';

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
// Already sent back once for this stop: do not loop forever.
if (input.stop_hook_active) process.exit(0);

const cwd = input.cwd || process.cwd();
if (!readConfig(process.env.CLAUDE_PROJECT_DIR || cwd).waitForCi) process.exit(0);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
if (!branch || ['main', 'master', 'HEAD'].includes(branch)) process.exit(0);

const reason = ciStopReason(currentPr(cwd), git(['rev-parse', 'HEAD'], cwd));
if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }));
