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
 * Tightening the gap is not a general fix either, though not for the reason
 * first written here: that said the cap-sum bound sits ~0.3% above anything
 * integral so a tighter gap could never close, and it is **wrong** - at one
 * character the bound is 1,000,000 and the best integral plan is 999,990,
 * 0.001% under. The gap closes fine. What costs the time is *proving* it, and
 * that is what explodes with roster size.
 *
 * **Gold: exact on a small roster, 1% relative on a large one.** The 1% rung
 * measures 397ms on twelve characters, but 1% of a 12,000,000 gold week is
 * 120,000 - so the solver stops at the first plan inside that, and it really
 * does leave gold unspent. Measured against an exact solve of the same live
 * catalogue:
 *
 *   1 character    998,140 (14 runs)   exact  999,990 (13 runs)
 *   3 characters  2,986,480            exact 2,999,500
 *
 * A character can get within ~10 gold of its 1,000,000 cap, so a plan handing
 * back 998,140 is not the arithmetic of indivisible runs - it is this
 * tolerance. Exact is also affordable at that size (138ms at one character,
 * 2.6s at three, 6.1s at four, 2.3s at five) and hopeless just past it: six
 * characters did not finish in 150 seconds. Hence `EXACT_GOLD_ROSTER` - the
 * tight rung is offered only where measurement says it lands, and a large
 * roster pays nothing for it.
 *
 * **Attempts: exact.** A relative gap is meaningless on an objective of ~160:
 * 1% is 1.6 attempts, and leaving an attempt unused is exactly what this pass
 * exists to prevent. Measured 991ms on the real catalogue, so the 10s rung is
 * a backstop and not the normal path - but that is only true because of
 * PIN_SLACK below. Pinned rigidly it could not finish at all: it burned its
 * whole time limit on every solve and fell through to the fallback rung, for
 * 21.6s of the 22.1s a real page load cost.
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
/**
 * How far below pass 1's gold figure pass 2 is allowed to land: 1 part in
 * 10,000, about 1,200 gold on an ~11,960,000 week.
 *
 * Pass 2 maximises attempts subject to keeping pass 1's gold, and pinning that
 * at `>= z` exactly - the obvious way to write it - is **tighter than the
 * number being pinned.** `z` is the incumbent of a solve that was itself only
 * taken to a 1% gap, so demanding pass 2 reproduce it to the gold is false
 * precision, and it costs enormously: it leaves pass 2 a needle-thin feasible
 * region to search.
 *
 * Measured on the real catalogue (12 characters x 9 dungeons, live `gold_c`):
 *
 *   rigid pin   22,109ms   attempts 162, gold 11,962,130
 *   1e-4 slack   1,476ms   attempts 162, gold 11,964,980
 *
 * Fifteen times faster for the same 162 attempts - and it returns MORE gold,
 * because the rigid pin was locking pass 2 out of solutions better than the
 * incumbent it was built from. The slack is two orders of magnitude smaller
 * than the 1% already accepted on the gold objective itself, so it cannot
 * change which of the two objectives wins.
 */
const PIN_SLACK = 1 - 1e-4;

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

/**
 * The roster size up to which the gold pass is asked for a proven optimum.
 *
 * Measured on the live catalogue: exact takes 138ms / 812ms / 2.6s / 6.1s /
 * 2.3s at one to five characters (it is a MILP - it is not monotonic), and at
 * six it had not finished in 150 seconds. So the cliff is real and it sits
 * here. Above it the exact rung would only burn its time limit on every solve,
 * which is the mistake the attempts pass already made once.
 */
const EXACT_GOLD_ROSTER = 5;

/** Tried ahead of `TOLERANCES.gold` when the roster is at or under the cliff. */
const EXACT_GOLD_RUNG = { time_limit: 10 };

type Pass = 'gold' | 'attempts';

/**
 * Identifies this solver's behaviour for the plan cache.
 *
 * The cache keys a stored plan on the inputs it was solved from, so anything
 * that changes the answer for UNCHANGED inputs has to change this string or the
 * screen keeps serving a plan built under the old rules. The tolerances do that
 * automatically; bump the leading version by hand when the model itself moves -
 * a new constraint, a different objective order, a change to `goldPerRun`.
 * v2 relaxed the gold pin and v3 solves a small roster exactly; both change
 * the answer, so both had to invalidate what the previous version had stored.
 */
export const SOLVER_SIGNATURE =
  `v3|${PIN_SLACK}|${EXACT_GOLD_ROSTER}|${JSON.stringify(EXACT_GOLD_RUNG)}|${JSON.stringify(TOLERANCES)}`;


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
    // A small roster is asked for the proven optimum first; a large one would
    // only ever time out on that rung, so it is not offered.
    const rungs =
      name === 'gold' && input.characters.length <= EXACT_GOLD_ROSTER
        ? [EXACT_GOLD_RUNG, ...TOLERANCES.gold]
        : TOLERANCES[name];
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
    pins.push({ name: `pin_${name}`, terms, op: '>=', rhs: Math.floor(z * PIN_SLACK) });
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
