/**
 * Week arithmetic. This is the only place in the app that decides when a week
 * began, for both dungeon attempt caps and the weekly gold cap.
 *
 * Weekdays are ISO: Monday = 1 ... Sunday = 7.
 */

const DAY_MS = 86_400_000;
const ISO_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Wall-clock parts of an instant as read in `timeZone`. */
function partsIn(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) p[part.type] = part.value;
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
  };
}

/** Offset in ms to add to a UTC instant to get its wall-clock reading in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

/**
 * The UTC instant at which a given wall-clock time occurs in `timeZone`.
 *
 * Done in two steps because the offset depends on the instant we are trying to
 * find: guess using the offset at the naive timestamp, then re-read the offset
 * at the guess and correct. One correction is enough for real time zones.
 */
function zonedWallClockToInstant(
  year: number, month: number, day: number, hour: number, timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour);
  const guess = naive - zoneOffsetMs(new Date(naive), timeZone);
  return new Date(naive - zoneOffsetMs(new Date(guess), timeZone));
}

/** ISO weekday of an instant as read in `timeZone`. Monday = 1 ... Sunday = 7. */
export function zonedWeekday(instant: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
    .format(instant);
  const index = ISO_DAYS.indexOf(short as (typeof ISO_DAYS)[number]);
  if (index === -1) throw new Error(`unrecognised weekday "${short}" for ${timeZone}`);
  return index + 1;
}

/**
 * The most recent occurrence of `weekday` at `hour`:00 in `timeZone`, at or
 * before `now`. The reset instant itself counts as the new week.
 */
export function lastReset(
  weekday: number, hour: number, timeZone: string, now: Date,
): Date {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw new RangeError(`weekday must be an integer 1-7, got ${weekday}`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour must be an integer 0-23, got ${hour}`);
  }

  const today = partsIn(now, timeZone);
  const daysBack = (zonedWeekday(now, timeZone) - weekday + 7) % 7;

  // Walk back over calendar days using a UTC proxy date, so no DST shift can
  // move us onto the wrong day. Only the final wall-clock -> instant conversion
  // is zone-aware.
  const proxy = Date.UTC(today.year, today.month - 1, today.day) - daysBack * DAY_MS;

  const at = (ms: number) => {
    const d = new Date(ms);
    return zonedWallClockToInstant(
      d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, timeZone,
    );
  };

  const candidate = at(proxy);
  return candidate.getTime() <= now.getTime() ? candidate : at(proxy - 7 * DAY_MS);
}
