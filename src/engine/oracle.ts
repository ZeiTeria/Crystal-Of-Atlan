import { buildCells, type Cell } from './cells';
import { validate } from './validate';
import type { PlanAssignment, PlanInput, PlanResult, PlanTotals } from './types';

/** Lexicographic comparison: credited gold, then attempts. */
function isBetter(a: PlanTotals, b: PlanTotals): boolean {
  if (a.gold !== b.gold) return a.gold > b.gold;
  return a.attempts > b.attempts;
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

  // Gold is NOT a budget that limits runs. The weekly cap truncates what a
  // character is paid, so running past it is legal and simply unpaid - which
  // means the only thing pruning this search is the account attempt pool.
  const earned: Record<string, number> = Object.fromEntries(
    input.characters.map((c) => [c.id, 0]),
  );

  /** What the account is actually paid: every character's gold, each capped. */
  const credited = (): number =>
    input.characters.reduce(
      (sum, c) => sum + Math.min(earned[c.id] ?? 0, input.goldHeadroom[c.id] ?? 0),
      0,
    );

  const current = new Array<number>(cells.length).fill(0);
  let best: Best | null = null;

  const search = (index: number, attempts: number): void => {
    const cell = cells[index];
    if (cell === undefined) {
      // Past the last cell: a complete plan.
      const totals: PlanTotals = { attempts, gold: credited() };
      if (best === null || isBetter(totals, best.totals)) {
        best = { totals, runs: [...current] };
      }
      return;
    }

    for (let runs = cell.min; runs <= cell.max; runs++) {
      // Attempts rise monotonically with `runs`, so the first failure means
      // every larger value fails too.
      if ((accountLeft[cell.dungeonId] ?? 0) < runs) break;

      accountLeft[cell.dungeonId] = (accountLeft[cell.dungeonId] ?? 0) - runs;
      earned[cell.characterId] = (earned[cell.characterId] ?? 0) + runs * cell.goldPerRun;
      current[index] = runs;

      search(index + 1, attempts + runs);

      accountLeft[cell.dungeonId] = (accountLeft[cell.dungeonId] ?? 0) + runs;
      earned[cell.characterId] = (earned[cell.characterId] ?? 0) - runs * cell.goldPerRun;
      current[index] = 0;
    }
  };

  search(0, 0);
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

  let clampedGold = 0;
  for (const character of input.characters) {
    const earned = assignments
      .filter((a) => a.characterId === character.id)
      .reduce((sum, a) => sum + a.goldTotal, 0);
    const headroom = input.goldHeadroom[character.id] ?? 0;
    clampedGold += Math.min(earned, headroom);
  }

  return { status: 'optimal', assignments, totals: { attempts: best.totals.attempts, gold: clampedGold } };
}
