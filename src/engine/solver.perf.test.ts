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
 * not public. It takes 30 SECONDS to solve exactly, and ~0.8s as configured.
 * See `TOLERANCES` in `solver.ts`.
 *
 * The bound this asserts is deliberately loose - the point is seconds versus
 * minutes, not a benchmark. Twelve characters is the one roster size the exact
 * rung cannot close, so this is the case that has to stay merely fast; the test
 * below it is the one that has to stay exact.
 */
function buffedFullAccount(roster = 12, dungeonCount = 9) {
  // Irregular figures, and C on seven of nine dungeons, because that is what
  // measuring produces - and it is what makes this hard. The same instance with
  // round multiples of 500 solves exactly in 771ms; these figures take 30s.
  const figures = [93_117, 47_111, 99_143, 64_879, 79_313, 72_701, 52_579, 74_821, 50_411,
    88_237, 61_543, 95_819].slice(0, dungeonCount);
  const cs = [51_900, 19_400, 50_600, 34_900, 48_500, 42_700, 24_300, 0, 0,
    46_100, 31_700, 53_300];
  if (figures.length < dungeonCount) throw new Error(`no figures for ${dungeonCount} dungeons`);
  const dungeons = figures.map((g, i) =>
    aDungeon(`d${i}`, {
      gold: { solo: g, story: g, elite: g, legend: g },
      goldC: cs[i] ?? 0,
      // One dungeon the player is not obliged to run, as in the real catalogue.
      default_min_runs: i === 8 ? 0 : 1,
    }),
  );
  // The four buff combinations that exist with abnormal sense off: a character
  // has a title (+2%), a potion (+10%), both, or neither.
  const buffs = [0, 0.02, 0.1, 0.12];
  const characters = Array.from({ length: roster }, (_, i) =>
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
    // 2.8s measured here (a 2s exact leash that cannot close at this size, then
    // 392ms at 1e-2 and 401ms for attempts). Generous for a slower machine, but
    // still well clear of the 14s a 1e-4 middle rung cost.
    expect(elapsed).toBeLessThan(8_000);
    // The attempts pass keeps its exact tolerance, so the plan still spends
    // nearly every attempt the account caps allow (9 dungeons x 18).
    expect(result.totals.attempts).toBeGreaterThan(155);
    console.log(`solve ${elapsed}ms attempts ${result.totals.attempts} gold ${result.totals.gold}`);
  }, 300_000);
});

describe('solveOptimal on a small roster', () => {
  /**
   * A small roster must be CREDITED its cap exactly - 1,000,000 each, not
   * 999,990 and not 990,615 - because running past the cap is legal and the
   * overflow is simply unpaid, so there is always a plan that reaches it if the
   * attempts exist. Nothing else competes for those attempts at this size.
   *
   * This is the guard on two things at once: the credit model (a hard gold row
   * caps *earned*, which indivisible runs cannot land on exactly) and the exact
   * first rung (a relative gap lets HiGHS report `Optimal` at 990,000, since
   * the cap itself is the bound it measures against).
   */
  it('credits a small roster exactly its gold cap', async () => {
    const input = buffedFullAccount(3);
    const result = await solveOptimal(input);

    expect(result.status).toBe('optimal');
    if (result.status !== 'optimal') return;

    for (const character of input.characters) {
      const earned = result.assignments
        .filter((a) => a.characterId === character.id)
        .reduce((sum, a) => sum + a.goldTotal, 0);
      const cap = input.goldHeadroom[character.id] ?? 0;
      expect(cap).toBeGreaterThan(0);
      expect(Math.min(earned, cap), `character ${character.id} credited ${Math.min(earned, cap)} of its ${cap} cap`)
        .toBe(cap);
    }
  });

  /**
   * What happens when the account GROWS - a thirteenth character, a tenth
   * dungeon - because the answer is counter-intuitive and worth pinning down.
   *
   * A new dungeon adds its own 18 weekly attempts to the account pool, and once
   * the pool can cap every character the sum of the caps is ATTAINED: the LP
   * bound equals the achievable value, so the exact rung proves it immediately.
   * Measured on this instance:
   *
   *   12 chars,  9 dungeons (162 attempts)   2,929ms   11,688,564    1/12 capped
   *   13 chars,  9 dungeons (162 attempts)   2,047ms   11,654,114    2/13 capped
   *   12 chars, 10 dungeons (180 attempts)      83ms   12,000,000   12/12 capped
   *   13 chars, 10 dungeons (180 attempts)     381ms   13,000,000   13/13 capped
   *   14 chars, 10 dungeons (180 attempts)   2,591ms   13,331,046    0/14 capped
   *   16 chars, 12 dungeons (216 attempts)   1,962ms   16,000,000   16/16 capped
   *
   * So growth is not the thing to fear - a new dungeon makes the solve FASTER.
   * The hard cases are the ones where the attempts nearly but not quite suffice,
   * because that is where the solver must decide who goes short. Today's account
   * (12 x 9) is one of those.
   */
  it('caps every character once the attempts suffice, at a size above today', async () => {
    const input = buffedFullAccount(13, 10);
    const result = await solveOptimal(input);

    expect(result.status).toBe('optimal');
    if (result.status !== 'optimal') return;

    for (const character of input.characters) {
      const earned = result.assignments
        .filter((a) => a.characterId === character.id)
        .reduce((sum, a) => sum + a.goldTotal, 0);
      const cap = input.goldHeadroom[character.id] ?? 0;
      expect(Math.min(earned, cap), `character ${character.id} fell short of its cap`)
        .toBe(cap);
    }
  });
});
