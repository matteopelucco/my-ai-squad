#!/usr/bin/env node
// Budget planner for /squad-core:run-tasks. Pure arithmetic: it never reads the plan's usage
// itself (Claude Code documents `/usage` for people, not a programmatic read); the orchestrator
// passes the percentages the user reads from `/usage`, or falls back to a fixed task count.
//
// Usage:
//   node budget.mjs --used-5h 30 --used-week 40 [--n 4] [--cost-5h 10 --cost-week 3] [--config .claude/squad.json]
//   node budget.mjs --learn --before-5h 30 --after-5h 38 --before-week 40 --after-week 42 [--cost-5h 10 --cost-week 3]
// Prints one JSON object. Exit code 0 always, except on invalid arguments (2).

import { readFileSync } from 'node:fs';

export const DEFAULTS = {
  caps: { fiveHour: 80, weekly: 85, context: 60 },
  costPerTask: { fiveHour: 10, weekly: 3 },
  fallbackTasks: 2,
  maxTasksWithoutN: 5,
};

/** Merges the `budget` section of .claude/squad.json over the defaults. */
export function resolveConfig(budget = {}) {
  return {
    ...DEFAULTS,
    ...budget,
    caps: { ...DEFAULTS.caps, ...(budget.caps ?? {}) },
    costPerTask: { ...DEFAULTS.costPerTask, ...(budget.costPerTask ?? {}) },
  };
}

const isPercent = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/**
 * How many tasks fit under the caps.
 * @param {{ used5h?: number, usedWeek?: number, n?: number, cost5h?: number, costWeek?: number }} input
 * @param {ReturnType<typeof resolveConfig>} config
 */
export function planBudget(input, config = resolveConfig()) {
  const { used5h, usedWeek, n } = input;
  const cost5h = input.cost5h ?? config.costPerTask.fiveHour;
  const costWeek = input.costWeek ?? config.costPerTask.weekly;

  if (!isPercent(used5h) || !isPercent(usedWeek)) {
    const tasks = n ?? config.fallbackTasks;
    return {
      n: tasks,
      budgetKnown: false,
      reason: `Consumi del piano non disponibili: uso ${n === undefined ? 'il numero di ripiego' : 'il numero richiesto'} (${tasks}) senza controllare i tetti.`,
    };
  }

  const fits5h = Math.max(0, Math.floor((config.caps.fiveHour - used5h) / cost5h));
  const fitsWeek = Math.max(0, Math.floor((config.caps.weekly - usedWeek) / costWeek));
  const fits = Math.min(fits5h, fitsWeek);
  const effective = Math.min(n ?? config.maxTasksWithoutN, fits);
  const limit = fits5h <= fitsWeek ? 'finestra di 5 ore' : 'finestra settimanale';
  return {
    n: effective,
    budgetKnown: true,
    fits,
    limitedBy: effective < (n ?? config.maxTasksWithoutN) ? limit : null,
    reason:
      effective === 0
        ? `Nessun task ci sta: tetto della ${limit} raggiunto (5 ore ${used5h}%/${config.caps.fiveHour}%, settimana ${usedWeek}%/${config.caps.weekly}%).`
        : `Ci stanno ${fits} task (5 ore ${used5h}%/${config.caps.fiveHour}%, settimana ${usedWeek}%/${config.caps.weekly}%): ne eseguo ${effective}.`,
  };
}

/**
 * New cost-per-task estimate after a task: the maximum observed difference (usage has 1% granularity
 * and other sessions consume in parallel), never below the previous estimate.
 */
export function learnCost(previous, before, after) {
  const delta = (a, b) => (isPercent(a) && isPercent(b) ? Math.max(0, b - a) : 0);
  return {
    cost5h: Math.max(previous.cost5h, delta(before.used5h, after.used5h)),
    costWeek: Math.max(previous.costWeek, delta(before.usedWeek, after.usedWeek)),
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`argomento inatteso: ${a}`);
    const key = a.slice(2);
    if (key === 'learn') out.learn = true;
    else {
      const value = Number(argv[i + 1]);
      if (key !== 'config' && !Number.isFinite(value)) throw new Error(`valore non numerico per ${a}`);
      out[key] = key === 'config' ? argv[i + 1] : value;
      i += 1;
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    let budget = {};
    if (args.config) {
      try {
        budget = JSON.parse(readFileSync(args.config, 'utf8')).budget ?? {};
      } catch {
        budget = {};
      }
    }
    const config = resolveConfig(budget);
    const previous = {
      cost5h: args['cost-5h'] ?? config.costPerTask.fiveHour,
      costWeek: args['cost-week'] ?? config.costPerTask.weekly,
    };
    const result = args.learn
      ? learnCost(
          previous,
          { used5h: args['before-5h'], usedWeek: args['before-week'] },
          { used5h: args['after-5h'], usedWeek: args['after-week'] },
        )
      : planBudget(
          { used5h: args['used-5h'], usedWeek: args['used-week'], n: args.n, cost5h: args['cost-5h'], costWeek: args['cost-week'] },
          config,
        );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`budget: ${error.message}\n`);
    process.exit(2);
  }
}
