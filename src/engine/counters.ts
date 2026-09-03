import type { Character, Dungeon, GridEntry, PlanInput } from './types';

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
 * Builds the remaining-state the solver needs from the catalogue.
 *
 * There is no run log to subtract: the planner is a reference for what a week
 * SHOULD look like, not a tracker of what has been done, so every counter
 * starts at its full weekly allowance. Clamped at zero because a catalogue
 * value is only ever wrong in one direction.
 */
export function derivePlanInput(args: {
  characters: Character[];
  dungeons: Dungeon[];
  grid: GridEntry[];
  settings: Settings;
}): PlanInput {
  const { characters, dungeons, grid, settings } = args;

  const accountAttemptsLeft: Record<string, number> = Object.fromEntries(
    dungeons.map((d) => [d.id, Math.max(0, d.accountAttempts)]),
  );
  const characterAttemptsLeft: Record<string, Record<string, number>> = Object.fromEntries(
    characters.map((c) => [
      c.id,
      Object.fromEntries(dungeons.map((d) => [d.id, Math.max(0, d.characterAttempts)])),
    ]),
  );

  const goldHeadroom: Record<string, number> = Object.fromEntries(
    characters.map((c) => [c.id, Math.max(0, settings.goldCap)]),
  );

  return {
    characters,
    dungeons,
    grid,
    accountAttemptsLeft,
    characterAttemptsLeft,
    goldHeadroom,
    settings: {
      goldCap: settings.goldCap,
      goldResetWeekday: settings.goldResetWeekday,
      resetHour: settings.resetHour,
      timeZone: settings.timeZone,
    },
  };
}
