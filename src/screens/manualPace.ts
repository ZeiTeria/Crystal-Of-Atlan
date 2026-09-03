import { nextReset } from '../engine/resetWindow';
import type { Dungeon, PlanInput } from '../engine/types';

/**
 * Whole days left before each MANUAL dungeon resets.
 *
 * A manual dungeon allows one run per day, so three runs need three days. The
 * weekly per-character cap is 3 and a week is 7 days, which means this never
 * limits a week planned early - it only bites near the reset.
 *
 * Built once per render rather than per cell: `nextReset` formats through
 * `Intl`, which is slow enough that calling it for every character x dungeon
 * pair was measurable. Non-manual dungeons are absent from the map entirely.
 */
export function manualDaysLeft(
  dungeons: Dungeon[],
  settings: PlanInput['settings'],
  now: Date,
): Map<string, number> {
  const days = new Map<string, number>();
  for (const d of dungeons) {
    if (!d.manual) continue;
    const until = nextReset(d.resetWeekday, settings.resetHour, settings.timeZone, now).getTime();
    days.set(d.id, Math.floor((until - now.getTime()) / 86_400_000));
  }
  return days;
}

/**
 * Warns when a plan plans more runs than there are days left to make them.
 *
 * Floors the remaining days rather than rounding: a warning that fires slightly
 * early costs a glance, one that fires late costs the runs.
 *
 * `undefined` days means the dungeon is not manual, so there is nothing to say.
 */
export function manualWarning(daysLeft: number | undefined, runs: number): string | null {
  if (daysLeft === undefined || runs <= daysLeft) return null;
  return (
    `Only ${daysLeft}d until reset, but ${runs} runs planned. ` +
    'Manual dungeons only allow one run per day.'
  );
}
