// Pure decision logic for the squad-core guard hooks. No I/O here, so it can be
// unit-tested with `node --test "tests/hooks/*.test.mjs"`.

import path from 'node:path';

/** @typedef {{ decision: 'deny' | 'ask', reason: string }} Decision */

/** Label that lets an agent merge a PR (ADR-0004). */
export const AI_DRIVEN_LABEL = 'ai-driven';
/** Label that always reserves the merge to a human (ADR-0004). */
export const HUMAN_LABEL = 'human-in-the-loop';

/** @type {{ decision: 'deny' | 'ask', pattern: RegExp, reason: string }[]} */
export const COMMAND_RULES = [
  { decision: 'deny', pattern: /\bgh\s+pr\s+merge\b.*\s--admin\b/i, reason: 'Merge con --admin non consentito: il ruleset di main vale anche per gli agenti.' },
  { decision: 'deny', pattern: /\bgh\s+repo\s+(delete|archive|rename)\b/i, reason: 'Operazione distruttiva sul repository non consentita.' },
  { decision: 'deny', pattern: /\bgh\s+api\b(?=.*(branches\/\S+\/protection|\/rulesets))(?=.*(-X|--method)\s*(PUT|POST|PATCH|DELETE)\b)/i, reason: 'Protezioni di branch e ruleset si modificano solo con autorizzazione esplicita.' },
  { decision: 'ask', pattern: /\bgh\s+(secret|variable)\s+(set|delete|remove)\b/i, reason: 'Modifica di segreti o variabili GitHub: richiede approvazione esplicita.' },
  { decision: 'ask', pattern: /\bgh\s+repo\s+edit\b/i, reason: 'Modifica delle impostazioni del repository: richiede approvazione esplicita.' },

  { decision: 'deny', pattern: /\bgit\s+push\b.*\s(--force(?!-with-lease)|-f)\b/i, reason: 'Force push non consentito.' },
  { decision: 'ask', pattern: /\bgit\s+push\b.*\s--force-with-lease\b/i, reason: 'Force push with lease: confermare che il branch non sia condiviso.' },
  { decision: 'deny', pattern: /\bgit\s+push\b.*\s(\S+:)?(refs\/heads\/)?(main|master)(\s|$)/i, reason: 'Push diretto su main non consentito: usare un branch e una PR.' },
  { decision: 'deny', pattern: /\bgit\s+(commit|push)\b.*\s--no-verify\b/i, reason: 'Bypass degli hook Git non consentito.' },
  { decision: 'ask', pattern: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/i, reason: 'Comando Git distruttivo: confermare che non ci siano modifiche da preservare.' },

  { decision: 'deny', pattern: /\brm\s+-[a-z]*r[a-z]*\s+(\/|~|\$HOME|\/c\/?|[a-z]:[\\/]?)(\s|$)/i, reason: 'Cancellazione ricorsiva di una radice del filesystem.' },
];

/**
 * Splits a shell command line into its simple commands, so that a rule never matches
 * across `&&`, `||`, `;`, `|` or newlines (e.g. `git push … && gh pr create --base main`).
 * @param {string} command
 */
export function splitSegments(command) {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * PR references of every `gh pr merge` in the command ('' when the PR is the current
 * branch's one).
 * @param {string} command
 * @returns {string[]}
 */
export function mergeTargets(command) {
  const targets = [];
  for (const segment of splitSegments(command)) {
    const match = /\bgh\s+pr\s+merge\b(.*)$/i.exec(segment);
    if (!match) continue;
    const args = match[1].trim().split(/\s+/).filter(Boolean);
    // Flags that take a value: skip it so it is not taken for the PR reference.
    const withValue = new Set(['-b', '--body', '-F', '--body-file', '-t', '--subject', '-A', '--author-email', '--match-head-commit', '-R', '--repo']);
    let ref = '';
    for (let i = 0; i < args.length; i += 1) {
      if (withValue.has(args[i])) i += 1;
      else if (!args[i].startsWith('-')) {
        ref = args[i];
        break;
      }
    }
    targets.push(ref);
  }
  return targets;
}

/**
 * Whether a PR may be merged by an agent, given the labels of its linked issues
 * (ADR-0004): at least one issue is `ai-driven` and none is `human-in-the-loop`.
 * @param {string[][]} issueLabels labels of each issue the PR closes
 */
export function isAiDriven(issueLabels) {
  if (issueLabels.length === 0) return false;
  const all = issueLabels.flat();
  return all.includes(AI_DRIVEN_LABEL) && !all.includes(HUMAN_LABEL);
}

/**
 * Evaluates a shell command line. Returns the strictest decision among its segments
 * ('deny' over 'ask'), or null when it may proceed through the normal permission flow.
 * @param {string} command
 * @param {{ branch?: string | null, mergeAllowed?: boolean }} [context] `mergeAllowed`:
 *   every PR the command merges comes from an `ai-driven` issue; absent means not allowed.
 * @returns {Decision | null}
 */
export function evaluateCommand(command, context = {}) {
  let result = null;
  for (const segment of splitSegments(command)) {
    const decision = evaluateSegment(segment, context);
    if (decision?.decision === 'deny') return decision;
    result ??= decision;
  }
  return result;
}

/**
 * @param {string} segment a single simple command
 * @param {{ branch?: string | null, mergeAllowed?: boolean }} context
 * @returns {Decision | null}
 */
function evaluateSegment(segment, context) {
  for (const rule of COMMAND_RULES) {
    if (rule.pattern.test(segment)) return { decision: rule.decision, reason: rule.reason };
  }
  if (/\bgh\s+pr\s+merge\b/i.test(segment) && context.mergeAllowed !== true) {
    return {
      decision: 'deny',
      reason: `Il merge è consentito agli agenti solo per le PR che chiudono una issue "${AI_DRIVEN_LABEL}" (e mai "${HUMAN_LABEL}"): negli altri casi lo fa l'umano.`,
    };
  }
  const onMain = context.branch === 'main' || context.branch === 'master';
  if (onMain && /\bgit\s+commit\b/i.test(segment)) {
    return { decision: 'deny', reason: 'Commit su main non consentito: creare un branch tipo/<issue>-slug.' };
  }
  // A push without an explicit refspec from main would update main.
  if (onMain && /\bgit\s+push(\s+(-u|--set-upstream|origin))*\s*$/i.test(segment)) {
    return { decision: 'deny', reason: 'Push da main non consentito: usare un branch e una PR.' };
  }
  return null;
}

/**
 * Agents whose writes are confined to a profile of the same name in `writeScopes`, with the
 * scope they get when `.claude/squad.json` does not declare one (the template's default).
 */
export const DEFAULT_WRITE_SCOPES = {
  'product-analyst': ['docs/', 'specs/'],
  'test-engineer': ['tests/', 'test/', 'e2e/'],
};
export const SCOPED_AGENTS = Object.keys(DEFAULT_WRITE_SCOPES);

/**
 * Maps a hook's `agent_type` (bare or plugin-scoped, e.g. `squad-core:test-engineer`) to its
 * write profile, or undefined when the agent is not restricted.
 * @param {string | undefined} agentType
 */
export function agentProfile(agentType) {
  if (typeof agentType !== 'string') return undefined;
  const name = agentType.slice(agentType.lastIndexOf(':') + 1);
  return SCOPED_AGENTS.includes(name) ? name : undefined;
}

/**
 * Decides whether an agent profile may write `filePath`.
 * @param {Record<string, string[]>} scopes write scopes per profile, as path prefixes
 *   relative to the project root (POSIX separators); a prefix ending in "/" matches a
 *   directory, otherwise an exact file
 * @param {string} profile
 * @param {string} filePath absolute or project-relative path
 * @param {string} projectDir absolute project root
 * @param {string[]} [extraAllowedRoots] absolute roots always allowed (e.g. the OS temp dir)
 * @returns {Decision | null}
 */
export function evaluateWrite(scopes, profile, filePath, projectDir, extraAllowedRoots = []) {
  const allowedPaths = scopes[profile];
  if (!allowedPaths) return { decision: 'deny', reason: `Profilo di scrittura sconosciuto: ${profile}. Va dichiarato in writeScopes di .claude/squad.json.` };
  if (typeof filePath !== 'string' || filePath.length === 0) return null;

  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const absolute = path.resolve(projectDir, filePath);

  for (const root of extraAllowedRoots) {
    const rel = path.relative(fold(path.resolve(root)), fold(absolute));
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return null;
  }

  const relative = path.relative(fold(path.resolve(projectDir)), fold(absolute)).split(path.sep).join('/');
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { decision: 'deny', reason: `[${profile}] scrittura fuori dal progetto non consentita: ${filePath}` };
  }
  const allowed = allowedPaths.some((scope) => (scope.endsWith('/') ? relative.startsWith(fold(scope)) : relative === fold(scope)));
  if (allowed) return null;
  return {
    decision: 'deny',
    reason: `[${profile}] può scrivere solo in: ${allowedPaths.join(', ')} (writeScopes di .claude/squad.json). Percorso rifiutato: ${relative}. Non riprovare con un altro strumento: segnala la modifica necessaria all'orchestratore.`,
  };
}

const CHECK_FAILED = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);

/**
 * Groups a PR's `statusCheckRollup` (check runs and commit statuses, as `gh pr view --json`
 * returns them) by outcome. Skipped and neutral checks count as passed.
 * @param {{ name?: string, context?: string, status?: string, conclusion?: string, state?: string }[]} rollup
 * @returns {{ pending: string[], failed: string[] }}
 */
export function summarizeChecks(rollup = []) {
  const pending = [];
  const failed = [];
  for (const check of rollup) {
    const name = check.name || check.context || '?';
    const outcome = (check.conclusion || check.state || '').toUpperCase();
    // A check run is running until its status is COMPLETED; a commit status while PENDING/EXPECTED.
    const running = check.status ? check.status.toUpperCase() !== 'COMPLETED' : ['PENDING', 'EXPECTED'].includes(outcome);
    if (running) pending.push(name);
    else if (CHECK_FAILED.has(outcome)) failed.push(name);
  }
  return { pending, failed };
}

/**
 * Whether the session may end its turn given the CI of the current branch's PR: the reason to
 * keep working when the checks of the pushed commit are still running or have failed.
 * @param {{ number: number, state: string, headRefOid: string, statusCheckRollup?: object[] } | null} pr
 * @param {string | null} localHead commit checked out locally
 * @returns {string | null}
 */
export function ciStopReason(pr, localHead) {
  // Unpushed commits: the checks belong to an older commit, the push is still to come.
  if (!pr || pr.state !== 'OPEN' || !localHead || pr.headRefOid !== localHead) return null;
  const { pending, failed } = summarizeChecks(pr.statusCheckRollup);
  if (failed.length) {
    return (
      `La CI della PR #${pr.number} è fallita (${failed.join(', ')}). Prima di chiudere leggi solo i job falliti ` +
      `(\`gh run view <id> --log-failed\`) e correggi, oppure riporta all'utente l'esito e cosa deve decidere.`
    );
  }
  if (pending.length) {
    return (
      `La CI della PR #${pr.number} è in corso (${pending.join(', ')}). Attendila con un solo ` +
      `\`gh pr checks ${pr.number} --watch --fail-fast\` in background: verrai richiamato quando finisce. ` +
      `Se la stai già attendendo, o non spetta a te, dillo all'utente e chiudi.`
    );
  }
  return null;
}
