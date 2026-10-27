// Reads the project's squad configuration, `.claude/squad.json`:
//   { "verify": "npm run verify", "writeScopes": { "<profile>": ["docs/", "README.md"] } }

import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * @param {string} projectDir
 * @returns {{ verify?: string, writeScopes: Record<string, string[]> }}
 */
export function readConfig(projectDir) {
  try {
    const raw = JSON.parse(readFileSync(path.join(projectDir, '.claude', 'squad.json'), 'utf8'));
    return {
      verify: typeof raw.verify === 'string' && raw.verify.trim() ? raw.verify : undefined,
      writeScopes: raw.writeScopes && typeof raw.writeScopes === 'object' ? raw.writeScopes : {},
    };
  } catch {
    return { writeScopes: {} };
  }
}
