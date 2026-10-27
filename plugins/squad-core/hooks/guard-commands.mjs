#!/usr/bin/env node
// PreToolUse hook (Bash | PowerShell): denies or escalates commands that are reserved
// for explicit human approval. Rules live in ./lib/rules.mjs.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readConfig } from './lib/config.mjs';
import { mergeAllowed } from './lib/github.mjs';
import { evaluateCommand, mergeTargets } from './lib/rules.mjs';

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // Malformed input: defer to the normal permission flow.
}

const command = input?.tool_input?.command;
if (typeof command === 'string' && command.length > 0) {
  const cwd = input.cwd || process.cwd();
  const targets = mergeTargets(command);
  const humanOnly = targets.length > 0 && readConfig(process.env.CLAUDE_PROJECT_DIR || cwd).mergeMode === 'human';
  const result = evaluateCommand(command, {
    branch: currentBranch(cwd),
    mergeAllowed: targets.length > 0 && !humanOnly && mergeAllowed(targets, cwd),
  });
  if (result) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: result.decision,
          permissionDecisionReason: `[guard-commands] ${result.reason}`,
        },
      }),
    );
  }
}
