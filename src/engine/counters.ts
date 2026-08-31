import { lastReset } from './resetWindow';
import type { Character, Dungeon, GridEntry, PlanInput } from './types';

/** One logged run. The gold is stored as earned, not looked up, so editing the
 *  catalogue later cannot rewrite history. */
export interface Run {
  characterId: string;
  dungeonId: string;
  ranAt: Date;
  goldEarned: number;
}

export interface Settings {
  goldCap: number;
  /** ISO weekday the per-character gold cap resets on. */
  goldResetWeekday: number;
  /** Hour of day, in `timeZone`, that every reset happens at. */
  resetHour: number;
  /** The game server's timezone, e.g. 'Asia/Jakarta'. */
  timeZone: string;
}

/**
 * Turns the append-only run log into the remaining-state the solver needs.
 *
 * Each counter looks back to its own boundary: a dungeon to its own reset
 * weekday, the gold cap to the global one. That is why nothing needs a
 * scheduled reset job, and why a Thursday dungeon overlapping a Monday gold
 * week is handled without special cases.
 */
export function derivePlanInput(args: {
  characters: Character[];
  dungeons: Dungeon[];
  grid: GridEntry[];
  runs: Run[];
  settings: Settings;
  now: Date;
}): PlanInput {
  const { characters, dungeons, grid, runs, settings, now } = args;
  const { resetHour, timeZone } = settings;

  const knownCharacters = new Set(characters.map((c) => c.id));
  const dungeonById = new Map(dungeons.map((d) => [d.id, d]));

  const windowStart = new Map(
    dungeons.map((d) => [d.id, lastReset(d.resetWeekday, resetHour, timeZone, now).getTime()]),
  );
  const goldWindowStart =
    lastReset(settings.goldResetWeekday, resetHour, timeZone, now).getTime();

  const accountAttemptsLeft: Record<string, number> = Object.fromEntries(
    dungeons.map((d) => [d.id, d.accountAttempts]),
  );
  const characterAttemptsLeft: Record<string, Record<string, number>> = Object.fromEntries(
    characters.map((c) => [
      c.id,
      Object.fromEntries(dungeons.map((d) => [d.id, d.characterAttempts])),
    ]),
  );
  const goldUsed: Record<string, number> = Object.fromEntries(characters.map((c) => [c.id, 0]));

  for (const run of runs) {
    if (!knownCharacters.has(run.characterId)) continue;
    const dungeon = dungeonById.get(run.dungeonId);
    if (!dungeon) continue;
    const ranAt = run.ranAt.getTime();

    if (ranAt >= (windowStart.get(run.dungeonId) ?? Infinity)) {
      accountAttemptsLeft[run.dungeonId] = (accountAttemptsLeft[run.dungeonId] ?? 0) - 1;
      const perDungeon = characterAttemptsLeft[run.characterId];
      if (perDungeon) perDungeon[run.dungeonId] = (perDungeon[run.dungeonId] ?? 0) - 1;
    }

    if (ranAt >= goldWindowStart) {
      goldUsed[run.characterId] = (goldUsed[run.characterId] ?? 0) + run.goldEarned;
    }
  }

  // A counter can only be clamped at zero, never negative — the game would not
  // have allowed the extra run, but a hand-edited log might claim one.
  for (const id of Object.keys(accountAttemptsLeft)) {
    accountAttemptsLeft[id] = Math.max(0, accountAttemptsLeft[id] ?? 0);
  }
  for (const perDungeon of Object.values(characterAttemptsLeft)) {
    for (const id of Object.keys(perDungeon)) {
      perDungeon[id] = Math.max(0, perDungeon[id] ?? 0);
    }
  }

  const goldHeadroom: Record<string, number> = Object.fromEntries(
    characters.map((c) => [c.id, Math.max(0, settings.goldCap - (goldUsed[c.id] ?? 0))]),
  );

  return { characters, dungeons, grid, accountAttemptsLeft, characterAttemptsLeft, goldHeadroom };
}
