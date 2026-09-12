import highsLoader from 'highs';
import { buildCells, type Cell } from './cells';
import { validate } from './validate';
import type { PlanAssignment, PlanInput, PlanResult, PlanTotals } from './types';

/**
 * Thrown when the solver returns anything other than a proven optimum, or
 * returns a solution that violates a constraint it was given. The app must
 * never present such a result as "the best combination" — it is not one.
 */
export class SolverNotOptimalError extends Error {
  readonly pass: string;
  readonly status: string;

  constructor(pass: string, status: string) {
    super(`solver pass "${pass}" returned status ${status} instead of optimal`);
    this.name = 'SolverNotOptimalError';
    this.pass = pass;
    this.status = status;
  }
}

type Highs = Awaited<ReturnType<typeof highsLoader>>;

let instance: Promise<Highs> | null = null;
/** The WebAssembly module is loaded once and reused. */
function highs(): Promise<Highs> {
  const options = import.meta.env.MODE !== 'test'
    ? {
        locateFile: (file: string) => {
          if (file.endsWith('.wasm')) {
            return new URL('../../node_modules/highs/build/highs.wasm', import.meta.url).href;
          }
          return file;
        },
      }
    : {};
  instance ??= highsLoader(options);
  return instance;
}

const runVar = (i: number) => `n${i}`;

/**
 * How hard each pass is allowed to work, tried in order until one reports
 * `Optimal`. Per pass, because the two objectives need opposite treatment.
 *
 * **Why a tolerance at all.** Once `gold_c` is filled in, every character
 * prices a dungeon differently (buffs multiply C), so each character's weekly
 * gold cap becomes a knapsack over ~50,000-100,000-gold runs and the whole
 * model is twelve coupled knapsacks. Proving the exact optimum on the real
 * catalogue does not finish: measured **>120 seconds** at a 0.1% gap, against
 * 121ms with the same data and no buffs, where every character shares one
 * coefficient. That is the page sitting on "Solving..." forever.
 *
 * It cannot be fixed by tightening instead. The LP bound is the sum of the
 * caps - twelve characters x 1,000,000 - and no whole number of runs lands on
 * exactly 1,000,000, so the bound sits ~0.3% above anything integral and a gap
 * below that can never close, however long it runs.
 *
 * **Gold: 1% relative.** Measured 397ms, and the plan it returns is within
 * ~0.3% of the best figure a 26-second solve could find. On an ~11,900,000
 * gold week the difference is smaller than one run of the cheapest dungeon,
 * and the gold figures themselves are built on an explicitly estimated
 * `stone_rate` of 0.40 - so chasing the last 0.3% is false precision.
 *
 * **Attempts: exact.** A relative gap is meaningless on an objective of ~160:
 * 1% is 1.6 attempts, and leaving an attempt unused is exactly what this pass
 * exists to prevent. It stays affordable because gold is pinned only to its
 * tolerant optimum, which leaves it room - 716ms on the real catalogue, 2.9s
 * on the harder instance in `solver.perf.test.ts`, and its fallback rung gives
 * up one attempt rather than the whole pass.
 *
 * **Why optimality is the only thing relaxed.** `assertFeasible` re-checks
 * every account, character and gold cap in integer arithmetic afterwards, so a
 * plan that breaks a cap remains impossible however loose the tolerance gets.
 *
 * **Why a time limit too.** The hardness is fragile - scaling the same
 * instance down by its GCD pushed it past 120 seconds - so the second rung is
 * a deliberately loose fallback. If even that expires, the pass throws and the
 * screen shows an error with a Retry button. Never a page that hangs.
 */
const TOLERANCES: Record<Pass, Record<string, number>[]> = {
  gold: [
    { mip_rel_gap: 1e-2, time_limit: 10 },
    { mip_rel_gap: 1e-1, time_limit: 20 },
  ],
  attempts: [
    { time_limit: 10 },
    { mip_abs_gap: 1, time_limit: 20 },
  ],
};

type Pass = 'gold' | 'attempts';

/**
 * Identifies this solver's behaviour for the plan cache.
 *
 * The cache keys a stored plan on the inputs it was solved from, so anything
 * that changes the answer for UNCHANGED inputs has to change this string or the
 * screen keeps serving a plan built under the old rules. The tolerances do that
 * automatically; bump the leading version by hand when the model itself moves -
 * a new constraint, a different objective order, a change to `goldPerRun`.
 */
export const SOLVER_SIGNATURE = `v1|${JSON.stringify(TOLERANCES)}`;


interface Term {
  name: string;
  coef: number;
}

interface Row {
  name: string;
  terms: Term[];
  op: '<=' | '>=';
  rhs: number;
}

/**
 * Renders terms in LP format. Coefficients are always integers here (gold
 * values and counts), so they never need exponent notation — which LP format
 * does not accept. A zero coefficient is dropped rather than emitted, since
 * `+ 0 n3` is noise that only widens the coefficient range.
 */
function renderTerms(terms: Term[]): string {
  const parts = terms
    .filter((t) => t.coef !== 0)
    .map((t) => `${t.coef < 0 ? '-' : '+'} ${Math.abs(t.coef)} ${t.name}`);
  return parts.length > 0 ? parts.join(' ') : '0';
}

/**
 * Solves the plan exactly, optimising three objectives in strict priority:
 *   1. spend as many attempts as possible
 *   2. then maximise weekly-quest coverage
 *   3. then maximise gold
 *
 * Each pass re-solves with the previous pass's optimum pinned as a constraint.
 *
 * **Solver choice.** This uses HiGHS, not GLPK, and that is not interchangeable.
 * `glpk.js` returns provably INFEASIBLE integer solutions when one row mixes
 * coefficients of very different magnitude — exactly the shape of the weekly
 * gold cap, where a 500,000-gold dungeon and a 1-gold dungeon share a row.
 * Minimal reproduction: maximise n0+n1+n2 subject to 500000·n0 + n2 <= 1000000
 * with n2 pinned at 2 returns n0 = 2, i.e. 1,000,002 gold against a 1,000,000
 * cap. glpk.js exposes no tolerance controls to correct it. HiGHS returns the
 * correct n0 = 1. Do not "simplify" back to GLPK.
 */
export async function solveOptimal(input: PlanInput): Promise<PlanResult> {
  const conflicts = validate(input);
  if (conflicts.length > 0) return { status: 'infeasible', conflicts };

  const cells = buildCells(input);
  if (cells.length === 0) {
    return { status: 'optimal', assignments: [], totals: { attempts: 0, gold: 0 } };
  }

  const solver = await highs();

  const rows: Row[] = [];

  // One row per dungeon: the account-wide attempt cap.
  for (const dungeon of input.dungeons) {
    const terms = cells
      .filter((c) => c.dungeonId === dungeon.id)
      .map((c) => ({ name: runVar(c.index), coef: 1 }));
    if (terms.length === 0) continue;
    rows.push({
      name: `acct_${rows.length}`,
      terms,
      op: '<=',
      rhs: input.accountAttemptsLeft[dungeon.id] ?? 0,
    });
  }

  // One row per character: the weekly gold cap.
  for (const character of input.characters) {
    const charCells = cells.filter((c) => c.characterId === character.id);
    if (charCells.length === 0) continue;
    
    const terms = charCells.map((c) => ({ name: runVar(c.index), coef: c.goldPerRun }));
    const requiredGold = charCells.reduce((sum, c) => sum + c.min * c.goldPerRun, 0);
    const headroom = input.goldHeadroom[character.id] ?? 0;
    
    rows.push({
      name: `gold_${rows.length}`,
      terms,
      op: '<=',
      rhs: Math.max(headroom, requiredGold),
    });
  }

  const attemptsObjective: Term[] = cells.map((c) => ({ name: runVar(c.index), coef: 1 }));
  const goldObjective: Term[] = cells.map((c) => ({
    name: runVar(c.index),
    coef: c.goldPerRun,
  }));

  const pins: Row[] = [];

  const buildLp = (objective: Term[]): string => {
    const lines = ['Maximize', ` obj: ${renderTerms(objective)}`, 'Subject To'];
    for (const row of [...rows, ...pins]) {
      lines.push(` ${row.name}: ${renderTerms(row.terms)} ${row.op} ${row.rhs}`);
    }
    lines.push('Bounds');
    for (const cell of cells) {
      lines.push(` ${cell.min} <= ${runVar(cell.index)} <= ${cell.max}`);
    }
    lines.push('General');
    lines.push(` ${cells.map((c) => runVar(c.index)).join(' ')}`);
    lines.push('End');
    return lines.join('\n');
  };

  const solvePass = (name: Pass, objective: Term[]) => {
    const lp = buildLp(objective);
    const rungs = TOLERANCES[name];
    let result = solver.solve(lp, rungs[0]);
    for (let i = 1; i < rungs.length && result.Status !== 'Optimal'; i++) {
      result = solver.solve(lp, rungs[i]);
    }
    if (result.Status !== 'Optimal') {
      throw new SolverNotOptimalError(name, String(result.Status));
    }
    const vars: Record<string, number> = {};
    for (const [key, column] of Object.entries(result.Columns)) {
      vars[key] = Math.round(column.Primal ?? 0);
    }
    return { z: result.ObjectiveValue, vars };
  };

  const pin = (name: string, terms: Term[], z: number) => {
    if (terms.length === 0) return;
    pins.push({ name: `pin_${name}`, terms, op: '>=', rhs: Math.round(z) });
  };

  const gold = solvePass('gold', goldObjective);
  pin('gold', goldObjective, gold.z);

  const solution = solvePass('attempts', attemptsObjective).vars;

  const assignments: PlanAssignment[] = [];
  const totals: PlanTotals = { attempts: 0, gold: 0 };

  for (const cell of cells) {
    const runs = solution[runVar(cell.index)] ?? 0;
    if (runs <= 0) continue;
    const goldTotal = runs * cell.goldPerRun;
    assignments.push({
      characterId: cell.characterId,
      dungeonId: cell.dungeonId,
      runs,
      goldPerRun: cell.goldPerRun,
      goldTotal,
    });
    totals.attempts += runs;
  }

  // Cap the total gold at the headroom so the overall total reflects reality
  // even if minimums force a character over the cap.
  let clampedGold = 0;
  for (const character of input.characters) {
    const earned = assignments
      .filter((a) => a.characterId === character.id)
      .reduce((sum, a) => sum + a.goldTotal, 0);
    const headroom = input.goldHeadroom[character.id] ?? 0;
    clampedGold += Math.min(earned, headroom);
  }
  totals.gold = clampedGold;

  assertFeasible(input, cells, assignments);
  return { status: 'optimal', assignments, totals };
}

/**
 * Re-checks the returned plan against every constraint, in integer arithmetic.
 *
 * This is not defensive padding. A floating-point MILP solver CAN return a
 * solution that violates a constraint within its own tolerance — GLPK did
 * exactly that here, overshooting the weekly gold cap by 2 on a row mixing
 * 500,000 with 1. Silently handing the player a plan that exceeds a cap is the
 * worst outcome this module has, so the answer is verified rather than trusted.
 */
function assertFeasible(
  input: PlanInput,
  cells: Cell[],
  assignments: PlanAssignment[],
): void {
  const runsByCell = new Map<string, number>();
  for (const a of assignments) {
    runsByCell.set(`${a.characterId}|${a.dungeonId}`, a.runs);
  }

  for (const cell of cells) {
    const runs = runsByCell.get(`${cell.characterId}|${cell.dungeonId}`) ?? 0;
    if (runs < cell.min || runs > cell.max) {
      throw new SolverNotOptimalError(
        'verify',
        `${cell.characterId}/${cell.dungeonId} ran ${runs}, outside [${cell.min}, ${cell.max}]`,
      );
    }
  }

  for (const dungeon of input.dungeons) {
    const used = assignments
      .filter((a) => a.dungeonId === dungeon.id)
      .reduce((sum, a) => sum + a.runs, 0);
    const available = input.accountAttemptsLeft[dungeon.id] ?? 0;
    if (used > available) {
      throw new SolverNotOptimalError(
        'verify',
        `dungeon ${dungeon.id} used ${used} attempts of ${available}`,
      );
    }
  }

  for (const character of input.characters) {
    const earned = assignments
      .filter((a) => a.characterId === character.id)
      .reduce((sum, a) => sum + a.goldTotal, 0);
    
    const charCells = cells.filter((c) => c.characterId === character.id);
    const requiredGold = charCells.reduce((sum, c) => sum + c.min * c.goldPerRun, 0);
    const headroom = input.goldHeadroom[character.id] ?? 0;
    const effectiveCap = Math.max(headroom, requiredGold);

    if (earned > effectiveCap) {
      throw new SolverNotOptimalError(
        'verify',
        `character ${character.id} earned ${earned} gold against a ${effectiveCap} cap`,
      );
    }
  }
}
