// Finds the files a shell command line writes, so that an agent confined by `writeScopes`
// cannot leave its scope through Bash or PowerShell instead of Write/Edit. Pure logic, no I/O.
// It reads the command line only: a script file the command runs (`node build.mjs`,
// `npm test`) is not inspected, while inline code (`node -e`, `python -c`, a heredoc fed to
// an interpreter) is refused because its targets cannot be seen.

import path from 'node:path';
import { evaluateWrite } from './rules.mjs';

/** @typedef {import('./rules.mjs').Decision} Decision */
/** @typedef {{ w: string } | { op: string }} Token */

/**
 * Splits a command line into tokens, honouring quotes. Separators (`;`, `&&`, `||`, `&`,
 * newlines, parentheses) become `{ op: ';' }`, a pipe `{ op: '|' }`; redirections become `{ op: '>' }`,
 * `{ op: '>>' }`, `{ op: '>&' }` (descriptor duplication), `{ op: '<' }`, `{ op: '<<<' }`.
 * Heredoc bodies are dropped: they are data, not commands.
 * @param {string} command
 * @returns {Token[]}
 */
export function lex(command) {
  /** @type {Token[]} */
  const tokens = [];
  /** @type {string[]} */
  const heredocs = [];
  let word = '';
  let inWord = false;
  const flush = () => {
    if (inWord) tokens.push({ w: word });
    word = '';
    inWord = false;
  };
  const sep = (op = ';') => {
    flush();
    const last = tokens.at(-1);
    if (last && 'op' in last && (last.op === ';' || last.op === '|')) tokens.pop();
    if (tokens.length) tokens.push({ op });
  };

  let i = 0;
  while (i < command.length) {
    const c = command[i];
    const next = command[i + 1];
    if (c === '\n') {
      sep();
      i += 1;
      // Skip the body of every heredoc opened on the line just ended.
      while (heredocs.length) {
        const delimiter = heredocs.shift();
        while (i < command.length) {
          const end = command.indexOf('\n', i);
          const line = command.slice(i, end === -1 ? command.length : end);
          i = end === -1 ? command.length : end + 1;
          if (line.trim() === delimiter) break;
        }
      }
    } else if (c === ' ' || c === '\t' || c === '\r') {
      flush();
      i += 1;
    } else if (c === "'") {
      const end = command.indexOf("'", i + 1);
      word += command.slice(i + 1, end === -1 ? command.length : end);
      inWord = true;
      i = end === -1 ? command.length : end + 1;
    } else if (c === '"') {
      i += 1;
      while (i < command.length && command[i] !== '"') {
        if (command[i] === '\\' && (command[i + 1] === '"' || command[i + 1] === '\\')) i += 1;
        word += command[i];
        i += 1;
      }
      inWord = true;
      i += 1;
    } else if (c === '\\' && next !== undefined && /[\s'"\\;&|<>]/.test(next)) {
      word += next;
      inWord = true;
      i += 2;
    } else if (c === ';' || c === '|' || c === '&' || c === '(' || c === ')') {
      if (c === '&' && next === '>') {
        // `&>file`: stdout and stderr to a file.
        flush();
        tokens.push({ op: '>' });
        i += command[i + 2] === '>' ? 3 : 2;
      } else {
        const pipe = c === '|' && next !== '|';
        sep(pipe ? '|' : ';');
        i += c === next && (c === '&' || c === '|') ? 2 : 1;
      }
    } else if (c === '>') {
      // A descriptor number right before `>` (`2>`) belongs to the redirection.
      if (/^\d+$/.test(word)) {
        word = '';
        inWord = false;
      }
      flush();
      if (next === '>') {
        tokens.push({ op: '>>' });
        i += 2;
      } else if (next === '&') {
        tokens.push({ op: '>&' });
        i += 2;
      } else {
        tokens.push({ op: '>' });
        i += next === '|' ? 2 : 1;
      }
    } else if (c === '<') {
      flush();
      if (next === '<' && command[i + 2] === '<') {
        tokens.push({ op: '<<<' });
        i += 3;
      } else if (next === '<') {
        i += 2;
        if (command[i] === '-') i += 1;
        while (command[i] === ' ' || command[i] === '\t') i += 1;
        const match = /^(['"]?)([^\s'";&|<>]+)\1/.exec(command.slice(i));
        if (match) {
          heredocs.push(match[2]);
          i += match[0].length;
        }
        tokens.push({ op: '<<' });
      } else {
        tokens.push({ op: '<' });
        i += 1;
      }
    } else {
      word += c;
      inWord = true;
      i += 1;
    }
  }
  flush();
  return tokens;
}

const INTERPRETERS = {
  node: ['-e', '--eval', '-p', '--print'],
  deno: ['eval'],
  bun: ['-e', '--eval'],
  python: ['-c'],
  python3: ['-c'],
  py: ['-c'],
  ruby: ['-e'],
  php: ['-r'],
  perl: ['-e', '-E'],
};
const SHELLS = { sh: '-c', bash: '-c', zsh: '-c', dash: '-c', pwsh: '-command', powershell: '-command', cmd: '/c' };
const PREFIXES = new Set(['sudo', 'env', 'command', 'exec', 'time', 'nohup', 'npx']);
const POWERSHELL_WRITERS = new Set([
  'set-content', 'add-content', 'out-file', 'new-item', 'remove-item', 'move-item', 'copy-item', 'rename-item',
  'clear-content', 'tee-object', 'ni', 'ri', 'del', 'erase', 'rd', 'mi', 'move', 'cpi', 'copy', 'rni', 'ren', 'clc', 'ac',
]);
const POWERSHELL_PATH_PARAMS = new Set(['-path', '-literalpath', '-filepath', '-destination']);
const POWERSHELL_SWITCHES = new Set(['-force', '-recurse', '-append', '-nonewline', '-confirm', '-whatif', '-passthru', '-noclobber']);
const GIT_OPAQUE = new Set(['apply', 'am', 'clean', 'cherry-pick', 'revert', 'merge', 'rebase', 'pull']);

/**
 * What one simple command writes: the target paths it names, or `opaque` when it may write
 * files that the command line does not show.
 * @param {Token[]} tokens tokens of one simple command (no separators)
 * @param {{ piped?: boolean }} [options] `piped`: the command reads the output of a pipe
 * @returns {{ targets: string[], opaque?: string, nested?: string, cd?: string }}
 */
export function commandWrites(tokens, { piped = false } = {}) {
  const targets = [];
  /** @type {string[]} */
  const words = [];
  let stdin = piped;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if ('w' in t) {
      words.push(t.w);
      continue;
    }
    const operand = tokens[i + 1];
    if ((t.op === '>' || t.op === '>>') && operand && 'w' in operand) targets.push(operand.w);
    if (t.op === '<<' || t.op === '<<<' || t.op === '<') stdin = true;
    if (t.op !== '<<' && operand && 'w' in operand) i += 1;
  }

  while (words.length && (/^\w+=/.test(words[0]) || PREFIXES.has(words[0]))) words.shift();
  if (!words.length) return { targets };
  const name = path.basename(words[0].replaceAll('\\', '/')).toLowerCase().replace(/\.exe$/, '');
  const args = words.slice(1);
  const plain = args.filter((a) => !a.startsWith('-'));

  if (/\[(system\.)?io\.(file|directory)\]::/i.test(words.join(' '))) return { targets, opaque: 'API .NET di file' };
  if (name === 'cd' || name === 'pushd' || name === 'set-location' || name === 'sl') return { targets, cd: plain[0] };
  if (name === 'eval') return { targets, nested: args.join(' ') };
  if (name === 'xargs' || name === 'invoke-expression' || name === 'iex') return { targets, opaque: name };

  if (name in SHELLS) {
    const flag = args.findIndex((a) => a.toLowerCase() === SHELLS[name] || (name !== 'cmd' && a.toLowerCase() === '-c'));
    if (flag !== -1) return { targets, nested: args.slice(flag + 1).join(' ') };
    if (plain.length === 0 && stdin) return { targets, opaque: `${name} da standard input` };
    return { targets };
  }
  if (name in INTERPRETERS) {
    const inline = args.some((a) => INTERPRETERS[name].includes(a) || (name === 'perl' && /^-[a-zA-Z]*[eE]$/.test(a)));
    const perlInPlace = name === 'perl' && args.some((a) => /^-[a-zA-Z]*i/.test(a));
    if (perlInPlace) return { targets: [...targets, ...inPlaceTargets(args)] };
    if (inline) return { targets, opaque: `codice in linea (${name})` };
    if (plain[0] === '-' || (plain.length === 0 && stdin)) return { targets, opaque: `codice da standard input (${name})` };
    return { targets };
  }

  switch (name) {
    case 'tee':
      return { targets: [...targets, ...plain] };
    case 'sed':
      return args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place')) ? { targets: [...targets, ...inPlaceTargets(args)] } : { targets };
    case 'cp':
    case 'install':
    case 'ln': {
      const t = args.indexOf('-t');
      if (t !== -1 && args[t + 1]) return { targets: [...targets, args[t + 1]] };
      return { targets: plain.length ? [...targets, plain.at(-1)] : targets };
    }
    case 'mv':
    case 'rm':
    case 'rmdir':
    case 'unlink':
    case 'touch':
    case 'mkdir':
    case 'truncate':
    case 'shred':
      return { targets: [...targets, ...plain] };
    case 'dd':
      return { targets: [...targets, ...args.filter((a) => a.startsWith('of=')).map((a) => a.slice(3))] };
    case 'curl':
    case 'wget': {
      const flags = name === 'curl' ? ['-o', '--output'] : ['-O', '--output-document'];
      const out = args.flatMap((a, i) => (flags.includes(a) && args[i + 1] ? [args[i + 1]] : []));
      return { targets: [...targets, ...out] };
    }
    case 'git':
      return gitWrites(args, targets);
    default:
      if (POWERSHELL_WRITERS.has(name)) return { targets: [...targets, ...powershellTargets(name, args)] };
      return { targets };
  }
}

/** Files edited in place by `sed -i` / `perl -i`: the operands after the script. */
function inPlaceTargets(args) {
  const operands = [];
  let scriptGiven = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (['-e', '-f', '--expression', '--file'].includes(a) || /^-[a-zA-Z]*[eE]$/.test(a)) {
      scriptGiven = true;
      i += 1;
    } else if (!a.startsWith('-')) operands.push(a);
  }
  return scriptGiven ? operands : operands.slice(1);
}

function gitWrites(args, targets) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += ['-C', '-c'].includes(args[i]) ? 2 : 1;
  const sub = args[i];
  const rest = args.slice(i + 1);
  if (GIT_OPAQUE.has(sub)) return { targets, opaque: `git ${sub}` };
  if (sub === 'stash' && !['list', 'show'].includes(rest[0])) return { targets, opaque: 'git stash' };
  if (sub === 'reset' && rest.includes('--hard')) return { targets, opaque: 'git reset --hard' };
  if (sub === 'checkout') {
    const dashes = rest.indexOf('--');
    if (dashes !== -1) return { targets: [...targets, ...rest.slice(dashes + 1)] };
    return { targets: rest.includes('.') ? [...targets, '.'] : targets };
  }
  if (sub === 'restore' || sub === 'rm' || sub === 'mv') {
    const operands = [];
    for (let j = 0; j < rest.length; j += 1) {
      if (['-s', '--source'].includes(rest[j])) j += 1;
      else if (!rest[j].startsWith('-')) operands.push(rest[j]);
    }
    return { targets: [...targets, ...operands] };
  }
  return { targets };
}

function powershellTargets(name, args) {
  const named = [];
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i].toLowerCase();
    if (POWERSHELL_PATH_PARAMS.has(a)) {
      if (args[i + 1] !== undefined) named.push(args[i + 1]);
      i += 1;
    } else if (a.startsWith('-')) {
      if (!POWERSHELL_SWITCHES.has(a)) i += 1;
    } else positional.push(args[i]);
  }
  // Copying reads the source: only the destination is written.
  if (['copy-item', 'cpi', 'copy'].includes(name)) {
    const destination = args.findIndex((a) => a.toLowerCase() === '-destination');
    return destination !== -1 ? [args[destination + 1]] : positional.slice(1, 2);
  }
  // Positional parameters after the first are values (`-Value`, `-Encoding`, `-NewName`),
  // except the destination of a move.
  const paths = [...named, ...positional.slice(0, ['move-item', 'mi', 'move'].includes(name) ? 2 : 1)];
  return paths.flatMap((p) => p.split(','));
}

const DISCARDED = new Set(['/dev/null', '/dev/stdout', '/dev/stderr', 'nul', '$null']);

/**
 * Resolves a target as written on the command line to an absolute path, or null when it
 * depends on something the hook cannot know (a variable).
 * @param {string} target
 * @param {{ cwd: string, homeDir: string, tmpDir: string, platform?: string }} env
 */
export function resolveTarget(target, { cwd, homeDir, tmpDir, platform = process.platform }) {
  let t = target;
  t = t.replace(/^~(?=\/|\\|$)/, homeDir);
  t = t.replace(/^(\$\{?(TMPDIR|TMP|TEMP)\}?|\$env:(TMP|TEMP))(?=\/|\\|$)/i, tmpDir);
  t = t.replace(/^(\$\{?HOME\}?|\$env:USERPROFILE)(?=\/|\\|$)/i, homeDir);
  if (t.includes('$') || t.includes('`')) return null;
  if (/^\/tmp(\/|$)/.test(t)) t = tmpDir + t.slice(4);
  if (platform === 'win32') {
    const drive = /^\/([a-zA-Z])(\/|$)/.exec(t);
    if (drive) t = `${drive[1]}:/${t.slice(3)}`;
    return path.win32.resolve(cwd, t);
  }
  return path.resolve(cwd, t);
}

/**
 * Decides whether a confined agent may run a shell command line.
 * @param {string} command
 * @param {{ scopes: Record<string, string[]>, profile: string, projectDir: string, cwd?: string,
 *   homeDir: string, tmpDir: string, platform?: string }} context
 * @returns {Decision | null}
 */
export function evaluateShellWrites(command, context, depth = 0) {
  const { scopes, profile, projectDir, tmpDir } = context;
  let cwd = context.cwd || projectDir;
  const deny = (reason) => ({ decision: 'deny', reason: `[${profile}] ${reason} Scrivi i file con Write/Edit nei percorsi consentiti (${(scopes[profile] ?? []).join(', ')}); se serve altro, fermati e segnalalo all'orchestratore.` });
  if (depth > 3) return deny('Comando annidato troppo in profondità per essere verificato.');

  /** @type {{ tokens: Token[], piped: boolean }[]} */
  const commands = [{ tokens: [], piped: false }];
  for (const t of lex(command)) {
    if ('op' in t && (t.op === ';' || t.op === '|')) commands.push({ tokens: [], piped: t.op === '|' });
    else commands.at(-1).tokens.push(t);
  }
  for (const { tokens, piped } of commands) {
    const result = commandWrites(tokens, { piped });
    if (result.cd) {
      cwd = resolveTarget(result.cd, { ...context, cwd }) ?? cwd;
      continue;
    }
    if (result.opaque) return deny(`Comando shell che può scrivere file senza mostrare dove: ${result.opaque}.`);
    if (result.nested !== undefined) {
      const nested = evaluateShellWrites(result.nested, { ...context, cwd }, depth + 1);
      if (nested) return nested;
    }
    for (const target of result.targets) {
      if (DISCARDED.has(target.toLowerCase())) continue;
      const absolute = resolveTarget(target, { ...context, cwd });
      if (absolute === null) return deny(`Destinazione di scrittura non verificabile: ${target}.`);
      const decision = evaluateWrite(scopes, profile, absolute, projectDir, [tmpDir]);
      if (decision) return deny(`Scrittura dalla shell fuori perimetro: ${target}.`);
    }
  }
  return null;
}
