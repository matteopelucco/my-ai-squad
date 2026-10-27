#!/usr/bin/env node
// PreToolUse hook (Write | Edit | NotebookEdit) scoped to a subagent: restricts the
// files the agent may write. Usage: node guard-paths.mjs <profile>
// Scopes come from `writeScopes` in the project's .claude/squad.json.
// Exit code 2 blocks the tool call.

import { readFileSync } from 'node:fs';
import os from 'node:os';
import { readConfig } from './lib/config.mjs';
import { evaluateWrite } from './lib/rules.mjs';

const profile = process.argv[2];

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.stderr.write('[guard-paths] input del hook non leggibile: scrittura bloccata per prudenza.\n');
  process.exit(2);
}

const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const { writeScopes } = readConfig(projectDir);
const result = evaluateWrite(writeScopes, profile, filePath, projectDir, [os.tmpdir()]);

if (result) {
  process.stderr.write(`${result.reason}\n`);
  process.exit(2);
}
