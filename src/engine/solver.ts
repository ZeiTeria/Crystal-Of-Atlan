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
    const terms = cells
      .filter((c) => c.characterId === character.id)
      .map((c) => ({ name: runVar(c.index), coef: c.goldPerRun }));
    if (terms.length === 0) continue;
    rows.push({
      name: `gold_${rows.length}`,
      terms,
      op: '<=',
      rhs: input.goldHeadroom[character.id] ?? 0,
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

  const solvePass = (name: string, objective: Term[]) => {
    const result = solver.solve(buildLp(objective), {});
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
    totals.gold += goldTotal;
  }

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
    const headroom = input.goldHeadroom[character.id] ?? 0;
    if (earned > headroom) {
      throw new SolverNotOptimalError(
        'verify',
        `character ${character.id} earned ${earned} gold against a ${headroom} cap`,
      );
    }
  }
}
