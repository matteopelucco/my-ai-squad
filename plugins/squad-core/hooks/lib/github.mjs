// Looks up on GitHub whether the PRs a command merges may be merged by an agent.

import { execFileSync } from 'node:child_process';
import { isAiDriven } from './rules.mjs';

/** @param {string[]} args @param {string} cwd */
function gh(args, cwd) {
  return execFileSync('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000 });
}

/**
 * True only when every PR is closing at least one `ai-driven` issue and no
 * `human-in-the-loop` one. Any lookup failure counts as not allowed.
 * @param {string[]} refs PR references ('' = the current branch's PR)
 * @param {string} cwd
 * @param {(args: string[], cwd: string) => string} [run] injectable for tests
 */
export function mergeAllowed(refs, cwd, run = gh) {
  if (refs.length === 0) return false;
  try {
    return refs.every((ref) => {
      const pr = JSON.parse(run(['pr', 'view', ...(ref ? [ref] : []), '--json', 'closingIssuesReferences'], cwd));
      const issueLabels = pr.closingIssuesReferences.map((issue) => {
        const data = JSON.parse(run(['issue', 'view', String(issue.number), '--json', 'labels'], cwd));
        return data.labels.map((label) => label.name);
      });
      return isAiDriven(issueLabels);
    });
  } catch {
    return false;
  }
}
