#!/usr/bin/env node
// PreToolUse hook (Bash | PowerShell): remote Supabase operations only on the test project,
// no Vercel production deploys. Rules live in ./lib/rules.mjs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evaluateStackCommand } from './lib/rules.mjs';

/** Test project ref: `SUPABASE_TEST_PROJECT_REF`, else `supabase.testProjectRef` of `.claude/squad.json`. */
function testProjectRef(projectDir) {
  if (process.env.SUPABASE_TEST_PROJECT_REF) return process.env.SUPABASE_TEST_PROJECT_REF;
  try {
    const ref = JSON.parse(readFileSync(path.join(projectDir, '.claude', 'squad.json'), 'utf8'))?.supabase?.testProjectRef;
    return typeof ref === 'string' && ref.trim() ? ref.trim() : undefined;
  } catch {
    return undefined;
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
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const result = evaluateStackCommand(command, { testProjectRef: testProjectRef(projectDir) });
  if (result) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: result.decision,
          permissionDecisionReason: `[guard-stack] ${result.reason}`,
        },
      }),
    );
  }
}
