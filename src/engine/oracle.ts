import { buildCells, type Cell } from './cells';
import { validate } from './validate';
import type { PlanAssignment, PlanInput, PlanResult, PlanTotals } from './types';

/** Lexicographic comparison: attempts, then coverage, then gold. */
function isBetter(a: PlanTotals, b: PlanTotals): boolean {
  if (a.attempts !== b.attempts) return a.attempts > b.attempts;
  if (a.coverage !== b.coverage) return a.coverage > b.coverage;
  return a.gold > b.gold;
}

interface Best {
  totals: PlanTotals;
  runs: number[];
}

/**
 * Depth-first search over every legal combination, returning the lexicographic
 * best, or null when no combination satisfies the constraints.
 *
 * Split out from `solveExhaustive` so the result arrives as a `const` the
 * compiler can narrow — `best` is written inside a closure, which defeats
 * narrowing on a local variable and would otherwise need a cast.
 */
function findBest(input: PlanInput, cells: Cell[]): Best | null {
  const accountLeft: Record<string, number> = { ...input.accountAttemptsLeft };
  const goldLeft: Record<string, number> = { ...input.goldHeadroom };
  const current = new Array<number>(cells.length).fill(0);
  let best: Best | null = null;

  const search = (index: number, totals: PlanTotals): void => {
    const cell = cells[index];
    if (cell === undefined) {
      // Past the last cell: a complete plan.
      if (best === null || isBetter(totals, best.totals)) {
        best = { totals: { ...totals }, runs: [...current] };
      }
      return;
    }

    for (let runs = cell.min; runs <= cell.max; runs++) {
      // Consumption rises monotonically with `runs`, so the first failure means
      // every larger value fails too.
      if ((accountLeft[cell.dungeonId] ?? 0) < runs) break;
      const gold = runs * cell.goldPerRun;
      if ((goldLeft[cell.characterId] ?? 0) < gold) break;

      accountLeft[cell.dungeonId] = (accountLeft[cell.dungeonId] ?? 0) - runs;
      goldLeft[cell.characterId] = (goldLeft[cell.characterId] ?? 0) - gold;
      current[index] = runs;

      search(index + 1, {
        attempts: totals.attempts + runs,
        coverage: totals.coverage + (cell.countsForCoverage && runs >= 1 ? 1 : 0),
        gold: totals.gold + gold,
      });

      accountLeft[cell.dungeonId] = (accountLeft[cell.dungeonId] ?? 0) + runs;
      goldLeft[cell.characterId] = (goldLeft[cell.characterId] ?? 0) + gold;
      current[index] = 0;
    }
  };

  search(0, { attempts: 0, coverage: 0, gold: 0 });
  return best;
}

/**
 * Exhaustive enumeration of every legal plan, keeping the lexicographic best.
 *
 * TEST ORACLE ONLY. Exponential in the number of cells — never call this from
 * the app. It exists so `solver.ts` can be checked against an implementation
 * simple enough to be obviously correct.
 */
export function solveExhaustive(input: PlanInput): PlanResult {
  const conflicts = validate(input);
  if (conflicts.length > 0) return { status: 'infeasible', conflicts };

  const cells = buildCells(input);
  const best = findBest(input, cells);

  // Minimums can interact in ways `validate` cannot see, so finding nothing is
  // a real infeasibility, not a bug.
  if (best === null) return { status: 'infeasible', conflicts: [{ kind: 'no-feasible-plan' }] };

  const assignments: PlanAssignment[] = [];
  cells.forEach((cell, i) => {
    const runs = best.runs[i] ?? 0;
    if (runs > 0) {
      assignments.push({
        characterId: cell.characterId,
        dungeonId: cell.dungeonId,
        runs,
        goldPerRun: cell.goldPerRun,
        goldTotal: runs * cell.goldPerRun,
      });
    }
  });

  return { status: 'optimal', assignments, totals: best.totals };
}
