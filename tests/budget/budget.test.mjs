// Tests for the run-tasks budget planner. Run: node --test "tests/*/*.test.mjs"
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { learnCost, planBudget, resolveConfig } from '../../plugins/squad-core/skills/run-tasks/budget.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../plugins/squad-core/skills/run-tasks/budget.mjs');
const config = resolveConfig();

describe('planBudget', () => {
  it('fits tasks under the 5-hour and weekly caps, whichever is tighter', () => {
    // 5h: floor((80-30)/10)=5, week: floor((85-70)/3)=5
    assert.equal(planBudget({ used5h: 30, usedWeek: 70 }, config).fits, 5);
    // week is the tighter: floor((85-82)/3)=1
    const plan = planBudget({ used5h: 10, usedWeek: 82 }, config);
    assert.equal(plan.n, 1);
    assert.equal(plan.limitedBy, 'finestra settimanale');
  });

  it('caps the count at maxTasksWithoutN when no n is given, and at n when it fits', () => {
    assert.equal(planBudget({ used5h: 0, usedWeek: 0 }, config).n, 5);
    assert.equal(planBudget({ used5h: 0, usedWeek: 0, n: 2 }, config).n, 2);
    assert.equal(planBudget({ used5h: 0, usedWeek: 0, n: 20 }, config).n, 8); // 5h window: floor(80/10)=8; week: floor(85/3)=28
  });

  it('never exceeds the caps even when n is higher', () => {
    const plan = planBudget({ used5h: 60, usedWeek: 0, n: 9 }, config);
    assert.equal(plan.n, 2);
    assert.equal(plan.limitedBy, 'finestra di 5 ore');
  });

  it('returns zero when a cap is already reached', () => {
    assert.equal(planBudget({ used5h: 85, usedWeek: 10 }, config).n, 0);
    assert.match(planBudget({ used5h: 85, usedWeek: 10 }, config).reason, /Nessun task/);
  });

  it('falls back explicitly when usage is unknown', () => {
    const plan = planBudget({}, config);
    assert.equal(plan.budgetKnown, false);
    assert.equal(plan.n, 2);
    assert.equal(planBudget({ n: 4 }, config).n, 4);
    assert.equal(planBudget({ used5h: 'x', usedWeek: 10 }, config).budgetKnown, false);
  });

  it('honours configured caps and costs', () => {
    const custom = resolveConfig({ caps: { fiveHour: 50 }, costPerTask: { fiveHour: 20 } });
    assert.equal(planBudget({ used5h: 10, usedWeek: 0 }, custom).fits, 2);
  });
});

describe('learnCost', () => {
  it('keeps the maximum observed difference and never lowers the estimate', () => {
    const prev = { cost5h: 10, costWeek: 3 };
    assert.deepEqual(learnCost(prev, { used5h: 30, usedWeek: 40 }, { used5h: 45, usedWeek: 41 }), { cost5h: 15, costWeek: 3 });
    assert.deepEqual(learnCost(prev, { used5h: 30, usedWeek: 40 }, { used5h: 33, usedWeek: 40 }), prev);
    assert.deepEqual(learnCost(prev, {}, {}), prev);
  });
});

describe('budget.mjs CLI', () => {
  const run = (...args) => spawnSync('node', [script, ...args], { encoding: 'utf8' });

  it('prints a JSON plan', () => {
    const out = JSON.parse(run('--used-5h', '30', '--used-week', '40', '--n', '3').stdout);
    assert.equal(out.n, 3);
  });

  it('learns costs and rejects bad arguments', () => {
    const out = JSON.parse(run('--learn', '--before-5h', '30', '--after-5h', '42', '--before-week', '10', '--after-week', '11').stdout);
    assert.equal(out.cost5h, 12);
    assert.equal(run('--used-5h', 'abc').status, 2);
  });
});
