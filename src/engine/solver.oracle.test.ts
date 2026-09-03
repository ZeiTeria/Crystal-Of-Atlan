import { describe, expect, it } from 'vitest';
import { solveOptimal } from './solver';
import { solveExhaustive } from './oracle';
import { aCharacter, aDungeon, anInput } from './testing/build';
import type { PlanInput } from './types';

/** Deterministic PRNG so a failure is always reproducible from its seed. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Small random instances only: the oracle is exponential, so this stays inside
 * 3 characters x 3 dungeons where exhaustive search is still cheap.
 */
function randomInput(seed: number): PlanInput {
  const rand = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const characters = Array.from({ length: int(1, 3) }, (_, i) => aCharacter(`c${i}`));
  const dungeons = Array.from({ length: int(1, 3) }, (_, i) =>
    aDungeon(`d${i}`, {
      accountAttempts: int(1, 6),
      characterAttempts: int(1, 3),   // floor of 1, never 0
      gold: {
        // Includes values that divide 1,000,000 exactly and values just over
        // half of it — where a greedy or a sloppy bound goes wrong.
        solo: pick([0, 1, 100]),
        story: pick([0, 250_000, 300_000]),
        elite: pick([500_000, 600_000, 1_000_000]),
        legend: pick([0, 400_000, 700_000]),
      },
    }),
  );

  const grid = characters.flatMap((c) =>
    dungeons.map((d) => ({
      characterId: c.id,
      dungeonId: d.id,
      tier: pick(['none', 'solo', 'story', 'elite', 'legend'] as const),
      minRuns: rand() < 0.15 ? int(1, 2) : 0,
    })),
  );

  return anInput({
    characters, dungeons, grid,
    goldHeadroom: Object.fromEntries(
      characters.map((c) => [c.id, pick([1_000_000, 1_000_000, 600_000, 0])]),
    ),
  });
}

describe('solveOptimal agrees with exhaustive search', () => {
  it.each(Array.from({ length: 300 }, (_, i) => i + 1))(
    'seed %i',
    async (seed) => {
      const input = randomInput(seed);
      const expected = solveExhaustive(input);
      const actual = await solveOptimal(input);

      expect(actual.status).toBe(expected.status);
      if (expected.status === 'optimal' && actual.status === 'optimal') {
        // The optimal TOTALS must match exactly. The particular assignment may
        // differ between two equally optimal plans, which is fine.
        expect(actual.totals).toEqual(expected.totals);
      }
    },
  );
});
