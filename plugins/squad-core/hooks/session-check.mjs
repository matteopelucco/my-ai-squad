#!/usr/bin/env node
// SessionStart hook: warns when the plugin is active in a project without .claude/squad.json,
// so that an incomplete adoption shows up before an agent runs into its defaults.

import { readFileSync } from 'node:fs';
import { readConfig } from './lib/config.mjs';
import { DEFAULT_WRITE_SCOPES } from './lib/rules.mjs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  // No input: check the project directory all the same.
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
if (readConfig(projectDir).exists) process.exit(0);

const scopes = Object.entries(DEFAULT_WRITE_SCOPES)
  .map(([agent, paths]) => `${agent} ${paths.join(' ')}`)
  .join('; ');
const message =
  `my-ai-squad: .claude/squad.json non c'è, l'adozione è incompleta. Valgono i default: perimetri di scrittura (${scopes}), ` +
  "nessun comando di verifica per l'hook Stop, merge secondo il flusso ai-driven. Generalo dal template (docs/guides/adozione.md).";
process.stdout.write(
  JSON.stringify({
    systemMessage: message,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: message },
  }),
);
