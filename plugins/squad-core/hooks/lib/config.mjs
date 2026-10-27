// Reads the project's squad configuration, `.claude/squad.json`:
//   { "verify": "npm run verify", "mergeMode": "human" | "ai-driven",
//     "writeScopes": { "<profile>": ["docs/", "README.md"] } }
// `mergeMode: "human"` forbids every agent merge; anything else keeps the ADR-0004 flow.

import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * @param {string} projectDir
 * @returns {{ verify?: string, mergeMode?: string, writeScopes: Record<string, string[]> }}
 */
export function readConfig(projectDir) {
  try {
    const raw = JSON.parse(readFileSync(path.join(projectDir, '.claude', 'squad.json'), 'utf8'));
    return {
      verify: typeof raw.verify === 'string' && raw.verify.trim() ? raw.verify : undefined,
      mergeMode: typeof raw.mergeMode === 'string' ? raw.mergeMode : undefined,
      writeScopes: raw.writeScopes && typeof raw.writeScopes === 'object' ? raw.writeScopes : {},
    };
  } catch {
    return { writeScopes: {} };
  }
}
