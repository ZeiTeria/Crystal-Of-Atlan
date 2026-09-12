import { describe, expect, it } from 'vitest';
import { aCharacter, aDungeon, anInput } from './testing/build';
import { solveOptimal } from './solver';
import type { GridEntry } from './types';

/**
 * A full account whose characters carry different gold buffs, which is where
 * this MILP gets hard and where the "page is always Solving..." bug lives.
 *
 * While `gold_c` was 0 every character priced a dungeon identically and the
 * whole model was trivial. C is multiplied by each character's own buffs, so
 * with C filled in each character has its own coefficient, each character's
 * weekly gold cap becomes a knapsack over ~50,000-100,000-gold runs, and the
 * model is twelve of those coupled by the per-dungeon account caps. Proving
 * the exact optimum on the real catalogue did not finish inside 120 seconds;
 * this instance is the same shape - irregular figures, C on seven of nine
 * dungeons, one dungeon with no minimum - but not the measured ones, which are
 * not public. It takes 30 SECONDS to solve exactly, and ~3.5s as configured.
 * See `TOLERANCES` in `solver.ts`.
 *
 * The bound this asserts is deliberately loose - the point is seconds versus
 * minutes, not a benchmark.
 */
function buffedFullAccount() {
  // Irregular figures, and C on seven of nine dungeons, because that is what
  // measuring produces - and it is what makes this hard. The same instance with
  // round multiples of 500 solves exactly in 771ms; these figures take 30s.
  const figures = [93_117, 47_111, 99_143, 64_879, 79_313, 72_701, 52_579, 74_821, 50_411];
  const cs = [51_900, 19_400, 50_600, 34_900, 48_500, 42_700, 24_300, 0, 0];
  const dungeons = figures.map((g, i) =>
    aDungeon(`d${i}`, {
      gold: { solo: g, story: g, elite: g, legend: g },
      goldC: cs[i],
      // One dungeon the player is not obliged to run, as in the real catalogue.
      default_min_runs: i === 8 ? 0 : 1,
    }),
  );
  // The four buff combinations that exist with abnormal sense off: a character
  // has a title (+2%), a potion (+10%), both, or neither.
  const buffs = [0, 0.02, 0.1, 0.12];
  const characters = Array.from({ length: 12 }, (_, i) =>
    aCharacter(`c${i}`, { buffPct: buffs[i % buffs.length] }),
  );

  const grid: (Omit<GridEntry, 'maxRuns'> & { maxRuns?: number })[] = [];
  for (const c of characters) {
    for (const d of dungeons) {
      grid.push({
        characterId: c.id, dungeonId: d.id, tier: 'elite', minRuns: d.default_min_runs,
      });
    }
  }
  return anInput({ characters, dungeons, grid });
}

describe('solveOptimal on a buffed full account', () => {
  it('returns a plan in seconds, not minutes', async () => {
    const started = Date.now();
    const result = await solveOptimal(buffedFullAccount());
    const elapsed = Date.now() - started;

    expect(result.status).toBe('optimal');
    if (result.status !== 'optimal') return;
    expect(elapsed).toBeLessThan(10_000);
    // The attempts pass keeps its exact tolerance, so the plan still spends
    // nearly every attempt the account caps allow (9 dungeons x 18).
    expect(result.totals.attempts).toBeGreaterThan(155);
    console.log(`solve ${elapsed}ms attempts ${result.totals.attempts} gold ${result.totals.gold}`);
  }, 300_000);
});
