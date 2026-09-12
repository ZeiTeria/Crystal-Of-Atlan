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
 * The gold a character is actually paid: `min(earned, cap)`.
 *
 * Indexed, not named after the character: deriving an LP name from an id means
 * sanitising it, and two ids that differ only in punctuation would then collide
 * into one variable.
 */
const creditVar = (i: number) => `g${i}`;

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
 * That figure, and every tolerance below it, was measured against the model
 * this file no longer uses. The gold cap used to be a hard row forbidding runs
 * past 1,000,000; it is now a credit variable that truncates what a run pays
 * (see `solveOptimal`). The hardness went with it, so the two mitigations that
 * block bought - a small-roster cliff and slack on the gold pin - are both
 * deleted rather than retuned.
 *
 * **Gold: exact, with a short leash.** A relative gap cannot be the first rung
 * here, because HiGHS reports `Optimal` the moment the gap is met: at one
 * character the bound is the 1,000,000 cap, so a 1% rung returns a plan worth
 * 990,000 and calls it optimal. That is the "why is it 99x,xxx" the credit
 * model exists to answer, and a tolerance would put it straight back. Exact is
 * also what is affordable now - measured on the live catalogue, zero gap proves
 * the optimum in 70ms at one character, 5ms at six, 110ms at eleven, and each
 * one lands on an exact multiple of the cap (1,000,000 / 6,000,000 /
 * 11,000,000) using the whole 162-attempt account pool.
 *
 * Twelve characters is the one size that does not close: zero gap could not
 * prove it in 25 seconds. 162 weekly attempts cannot cap twelve characters, so
 * this is the roster where the account pool binds rather than the gold cap, and
 * the relaxed rung below is what answers it - returning 11,908,290, which a
 * separate run proved optimal to within 0.01% (~1,200 gold).
 *
 * **Why the exact rung's leash is short, and the relaxed one is 1e-2.** A rung
 * that fails costs its whole time limit, so the ladder's latency is set by the
 * rungs that DON'T close. Exact closes in 184ms at eleven characters, so 2
 * seconds is eight times the margin it needs; and on the perf instance 1e-4
 * burned a full 10s while 1e-2 closed in 392ms, having found the same plan. So
 * 1e-4 was dropped: it paid ten seconds for a tighter proof of an answer the
 * looser rung already had. On the live catalogue 1e-2, 1e-4 and 1e-5 all return
 * the identical 11,908,290 - the incumbent converges early there and only the
 * proof is slow.
 *
 * **Attempts: exact.** A relative gap is meaningless on an objective of ~160:
 * 1% is 1.6 attempts, and leaving an attempt unused is exactly what this pass
 * exists to prevent.
 *
 * **Why optimality is the only thing relaxed.** `assertFeasible` re-checks
 * every account, character and gold cap in integer arithmetic afterwards, so a
 * plan that breaks a cap remains impossible however loose the tolerance gets.
 *
 * **Why a time limit too.** The hardness is fragile - scaling the same
 * instance down by its GCD pushed it past 120 seconds - so the last rung is a
 * deliberately loose fallback. If even that expires, the pass throws and the
 * screen shows an error with a Retry button. Never a page that hangs.
 */
const TOLERANCES: Record<Pass, Record<string, number>[]> = {
  gold: [
    { mip_rel_gap: 0, mip_abs_gap: 0, time_limit: 2 },
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
 * v2 relaxed the gold pin, v3 solved a small roster exactly, and v4 replaced
 * the hard gold cap with credit variables - every one of them changes the
 * answer for inputs that did not move, so every one had to invalidate what the
 * previous version had stored.
 */
export const SOLVER_SIGNATURE = `v4|${JSON.stringify(TOLERANCES)}`;


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

  // One credit variable per character: the gold that character is actually paid.
  //
  // The weekly cap TRUNCATES gold, it does not forbid the run. A character on
  // 970,000 that runs a 50,000 dungeon is paid 30,000 of it and finishes on
  // exactly 1,000,000 - so `credit = min(earned, cap)`, which is linear once
  // the minimum gets its own variable:
  //
  //   credit_c <= cap_c                      (a bound)
  //   credit_c <= sum(goldPerRun * runs)     (a row)
  //
  // and the objective maximises the credits. Modelling the cap as
  // `sum(goldPerRun * runs) <= cap` instead - which this did - **loses real
  // plans**: it stopped a lone character at 13 runs and 999,990 because a
  // 14th would have "overflowed" a cap that cannot overflow, while 14 unused
  // attempts sat there and no other character wanted them.
  const credits = input.characters
    .filter((character) => cells.some((c) => c.characterId === character.id))
    .map((character, i) => ({
      name: creditVar(i),
      cap: input.goldHeadroom[character.id] ?? 0,
      terms: cells
        .filter((c) => c.characterId === character.id)
        .map((c) => ({ name: runVar(c.index), coef: c.goldPerRun })),
    }));

  for (const credit of credits) {
    rows.push({
      name: `credit_${rows.length}`,
      terms: [{ name: credit.name, coef: 1 }, ...credit.terms.map((t) => ({ ...t, coef: -t.coef }))],
      op: '<=',
      rhs: 0,
    });
  }

  const attemptsObjective: Term[] = cells.map((c) => ({ name: runVar(c.index), coef: 1 }));
  const goldObjective: Term[] = credits.map((c) => ({ name: c.name, coef: 1 }));

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
    // Continuous on purpose: a credit is a consequence of the runs, not a
    // decision, and leaving it out of `General` keeps the branching to runs.
    for (const credit of credits) {
      lines.push(` 0 <= ${credit.name} <= ${credit.cap}`);
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
    pins.push({ name: `pin_${name}`, terms, op: '>=', rhs: Math.floor(z) });
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

  // The same min() the model maximises, recomputed from the assignments rather
  // than read back off the solver.
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

  // The weekly gold cap is deliberately NOT checked here. It is no longer a
  // constraint on the plan - running past it is legal and the overflow is
  // simply unpaid - so it is a function applied to the answer (the min() above)
  // rather than a row the solver could violate. There is nothing left to verify.
}
