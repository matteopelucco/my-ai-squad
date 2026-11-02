// Reads the project's squad configuration, `.claude/squad.json`:
//   { "verify": "npm run verify", "mergeMode": "human" | "ai-driven",
//     "writeScopes": { "<profile>": ["docs/", "README.md"] } }
// `mergeMode: "human"` forbids every agent merge; anything else keeps the ADR-0004 flow.
// A restricted agent with no declared scope gets the template's default one, so a project
// without the file is still confined instead of blocked.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_WRITE_SCOPES } from './rules.mjs';

/**
 * @param {string} projectDir
 * @returns {{ exists: boolean, verify?: string, mergeMode?: string, writeScopes: Record<string, string[]> }}
 */
export function readConfig(projectDir) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path.join(projectDir, '.claude', 'squad.json'), 'utf8'));
  } catch (error) {
    // An unreadable file is not a missing one: keep the defaults but do not report it as absent.
    return { exists: error?.code !== 'ENOENT', writeScopes: { ...DEFAULT_WRITE_SCOPES } };
  }
  const declared = raw?.writeScopes && typeof raw.writeScopes === 'object' ? raw.writeScopes : {};
  return {
    exists: true,
    verify: typeof raw?.verify === 'string' && raw.verify.trim() ? raw.verify : undefined,
    mergeMode: typeof raw?.mergeMode === 'string' ? raw.mergeMode : undefined,
    writeScopes: { ...DEFAULT_WRITE_SCOPES, ...declared },
  };
}
