#!/usr/bin/env node
// PreToolUse hook (Bash | PowerShell): denies or escalates commands that are reserved
// for explicit human approval. Rules live in ./lib/rules.mjs. For an agent confined by
// `writeScopes` it also denies shell commands that write outside the scope (./lib/shell-writes.mjs),
// which guard-paths cannot see.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { readConfig } from './lib/config.mjs';
import { mergeAllowed } from './lib/github.mjs';
import { agentProfile, evaluateCommand, mergeTargets } from './lib/rules.mjs';
import { evaluateShellWrites } from './lib/shell-writes.mjs';

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
  const projectDir = process.env.CLAUDE_PROJECT_DIR || cwd;
  const config = readConfig(projectDir);
  const targets = mergeTargets(command);
  const humanOnly = targets.length > 0 && config.mergeMode === 'human';
  const profile = agentProfile(input.agent_type);
  const result =
    (profile &&
      evaluateShellWrites(command, { scopes: config.writeScopes, profile, projectDir, cwd, homeDir: os.homedir(), tmpDir: os.tmpdir() })) ||
    evaluateCommand(command, {
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
