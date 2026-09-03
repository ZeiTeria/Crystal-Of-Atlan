import type { Character, Dungeon, GridEntry, PlanInput } from '../types';

/**
 * Test data builders. Defaults are deliberately boring and generous so a test
 * only has to state the thing it is actually about.
 */

export function aCharacter(id: string): Character {
  return { id, name: id.toUpperCase(), class: null };
}

export function aDungeon(id: string, overrides: Partial<Dungeon> = {}): Dungeon {
  return {
    id,
    name: id.toUpperCase(),
    accountAttempts: 18,
    characterAttempts: 3,
    resetWeekday: 1,
    gold: { solo: 10, story: 20, elite: 30, legend: 40 },
    manual: false,
    default_tier: 'elite',
    default_min_runs: 1,
    sort_order: 0,
    group_name: null,
    short_name: null,
    goldEstimated: [],
    goldUnknown: false,
    ...overrides,
  };
}

/**
 * Builds a PlanInput, filling remaining-state maps from the caps unless the
 * caller states otherwise (i.e. "a fresh week, nothing run yet").
 */
export function anInput(parts: {
  characters: Character[];
  dungeons: Dungeon[];
  grid: (Omit<GridEntry, 'maxRuns'> & { maxRuns?: number })[];
  accountAttemptsLeft?: Record<string, number>;
  characterAttemptsLeft?: Record<string, Record<string, number>>;
  goldHeadroom?: Record<string, number>;
  goldCap?: number;
}): PlanInput {
  const { characters, dungeons, grid, goldCap = 1_000_000 } = parts;

  const accountAttemptsLeft = parts.accountAttemptsLeft
    ?? Object.fromEntries(dungeons.map((d) => [d.id, d.accountAttempts]));

  const characterAttemptsLeft = parts.characterAttemptsLeft
    ?? Object.fromEntries(characters.map((c) => [
      c.id,
      Object.fromEntries(dungeons.map((d) => [d.id, d.characterAttempts])),
    ]));

  const goldHeadroom = parts.goldHeadroom
    ?? Object.fromEntries(characters.map((c) => [c.id, goldCap]));

  const fullGrid: GridEntry[] = grid.map((g) => ({
    ...g,
    maxRuns: g.maxRuns ?? 3,
  }));

  return {
    characters,
    dungeons,
    grid: fullGrid,
    accountAttemptsLeft,
    characterAttemptsLeft,
    goldHeadroom,
    settings: {
      goldCap,
      goldResetWeekday: 1,
      resetHour: 6,
      timeZone: 'UTC',
    },
  };
}
