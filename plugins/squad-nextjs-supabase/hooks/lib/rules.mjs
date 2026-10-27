// Pure decision logic for the squad-nextjs-supabase guard hook: remote Supabase operations
// and Vercel production deploys. No I/O here, so it can be unit-tested with
// `node --test "tests/*/*.test.mjs"`.

/** @typedef {{ decision: 'deny' | 'ask', reason: string }} Decision */

/**
 * Splits a shell command line into its simple commands (same rule as squad-core: plugins are
 * installed separately, so they do not import each other).
 * @param {string} command
 */
export function splitSegments(command) {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Supabase subcommands that always act on a remote project. */
const SUPABASE_REMOTE = /\bsupabase\s+(db\s+(push|pull|dump)|link|migration\s+(repair|fetch)|functions\s+(deploy|delete)|secrets\s+(set|unset)|storage\s+(cp|mv|rm)|branches\s+(create|update|delete))\b/i;
/** Flags that turn any Supabase command into a remote one. */
const SUPABASE_REMOTE_FLAG = /\s--(linked|project-ref|db-url)\b/i;

/** @type {{ decision: 'deny' | 'ask', pattern: RegExp, reason: string }[]} */
export const STACK_RULES = [
  { decision: 'deny', pattern: /\bsupabase\s+(projects|orgs)\s+(create|delete)\b/i, reason: 'Creare o cancellare progetti Supabase spetta all\'umano.' },
  { decision: 'deny', pattern: /\bvercel\b.*\s--prod\b/i, reason: 'Il deploy di produzione avviene solo dal merge su main: niente deploy manuali.' },
  { decision: 'deny', pattern: /\bvercel\s+(promote|rollback|remove|rm|redeploy)\b/i, reason: 'Operazione sulla produzione Vercel: la fa l\'umano.' },
  { decision: 'deny', pattern: /\bvercel\s+(project|domains|dns|certs|alias)\s+(rm|remove)\b/i, reason: 'Operazione distruttiva su Vercel: la fa l\'umano.' },
  { decision: 'ask', pattern: /\bvercel\s+env\s+(add|rm|remove|pull)\b/i, reason: 'Variabili d\'ambiente Vercel: richiede approvazione esplicita.' },
];

/**
 * Evaluates a shell command line. Returns the strictest decision among its segments
 * ('deny' over 'ask'), or null when it may proceed through the normal permission flow.
 * @param {string} command
 * @param {{ testProjectRef?: string }} [context] ref of the Supabase TEST project: the only one
 *   an agent may touch remotely, and only when named explicitly with `--project-ref`
 * @returns {Decision | null}
 */
export function evaluateStackCommand(command, context = {}) {
  let result = null;
  for (const segment of splitSegments(command)) {
    const decision = evaluateSegment(segment, context);
    if (decision?.decision === 'deny') return decision;
    result ??= decision;
  }
  return result;
}

/**
 * @param {string} segment
 * @param {{ testProjectRef?: string }} context
 * @returns {Decision | null}
 */
function evaluateSegment(segment, context) {
  for (const rule of STACK_RULES) {
    if (rule.pattern.test(segment)) return { decision: rule.decision, reason: rule.reason };
  }
  if (!/\bsupabase\s/i.test(segment)) return null;
  if (!SUPABASE_REMOTE.test(segment) && !SUPABASE_REMOTE_FLAG.test(segment)) return null;

  if (/\s--db-url\b/i.test(segment)) {
    return { decision: 'deny', reason: 'Supabase con --db-url non è verificabile: usare --project-ref del progetto di test.' };
  }
  const ref = /\s--project-ref(?:\s+|=)["']?([a-z0-9]+)/i.exec(segment)?.[1];
  if (!context.testProjectRef) {
    return {
      decision: 'deny',
      reason: 'Operazione Supabase remota senza progetto di test configurato: imposta supabase.testProjectRef in .claude/squad.json (o SUPABASE_TEST_PROJECT_REF). La produzione la gestisce solo l\'umano.',
    };
  }
  if (ref !== context.testProjectRef) {
    return {
      decision: 'deny',
      reason: `Operazione Supabase remota consentita solo sul progetto di test, con --project-ref ${context.testProjectRef} esplicito. La produzione la gestisce solo l'umano.`,
    };
  }
  return null;
}
