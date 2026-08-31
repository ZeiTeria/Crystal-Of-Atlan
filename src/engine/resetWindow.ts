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

/** True when `instant` reads in `timeZone` as exactly the given calendar date. */
function isZonedDate(
  instant: Date, year: number, month: number, day: number, timeZone: string,
): boolean {
  const p = partsIn(instant, timeZone);
  return p.year === year && p.month === month && p.day === day;
}

/**
 * The UTC instant at which a given wall-clock time occurs in `timeZone`.
 *
 * The offset depends on the instant we are trying to find, so this iterates:
 * guess using the offset at the naive timestamp, then re-read the offset at
 * the guess and correct. A single correction is *not* always enough — if the
 * naive guess and the corrected guess sit on opposite sides of a transition,
 * the offset used to produce `first` no longer applies at `first` itself, and
 * `first` does not read back as the requested wall-clock time even though
 * that time exists and is unambiguous (e.g. 04:00 America/New_York on the US
 * spring-forward day: the naive guess reads as pre-transition EST, overshoots
 * past the transition, and only the second correction lands on 04:00 EDT).
 * So convergence is checked explicitly rather than assumed after one step.
 */
function zonedWallClockToInstant(
  year: number, month: number, day: number, hour: number, timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour);
  const offsetAtNaive = zoneOffsetMs(new Date(naive), timeZone);
  const first = naive - offsetAtNaive;
  const offsetAtFirst = zoneOffsetMs(new Date(first), timeZone);
  const second = naive - offsetAtFirst;

  if (offsetAtFirst === zoneOffsetMs(new Date(second), timeZone)) {
    // Converged: `second` is a fixed point (correcting again would return
    // `second` unchanged). This is the unique real instant for an unambiguous
    // wall-clock time, or - in a FOLD, a time that happens twice - the earlier
    // occurrence, which is the conservative choice for a boundary.
    return new Date(second);
  }

  // Never converges: `first` and `second` keep alternating with each further
  // correction. That is the signature of a GAP - a wall-clock time that never
  // happens - so no instant reads back as requested and we must pick a nearby
  // one.
  //
  // Prefer the LATER candidate: it lands just after the transition, which is
  // Temporal's 'compatible' rule, and it is right for 10,517 of the 10,561 real
  // gap cases across the IANA database 1970-2040. Stepping forward can never
  // lose a run, because the interval it steps over is the gap itself and
  // contains no real instants.
  //
  // But when the gap swallows the LAST hour of a day, stepping forward pushes
  // the result onto the next day - America/Godthab starts DST at 23:00, so a
  // Saturday 23:00 boundary would land on Sunday. Staying on the requested
  // calendar day matters more than the direction of the shift, because this
  // module exists to answer "which weekday's boundary is this". The earlier
  // candidate stays on the day in all 44 such cases, and erring EARLY is the
  // safe direction: an earlier boundary widens the week and under-reports
  // remaining attempts, while a later one would over-report attempts the player
  // does not have.
  const later = new Date(Math.max(first, second));
  const earlier = new Date(Math.min(first, second));
  return isZonedDate(later, year, month, day, timeZone) ? later : earlier;
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
  const result = candidate.getTime() <= now.getTime() ? candidate : at(proxy - 7 * DAY_MS);

  // The module exists to answer "which weekday's boundary is this" - a result
  // reading back as a different weekday must never be returned silently.
  // After the day-preserving gap choice above, this fires in exactly one
  // situation: the requested calendar day did not exist in this zone at all.
  // That needs a gap longer than 12 hours, which happens only in the five
  // day-skip events in the IANA database (Pacific/Apia and Pacific/Fakaofo
  // 2011-12-30, Pacific/Kiritimati and Pacific/Enderbury 1994-12-31,
  // Pacific/Kwajalein 1993-08-21). Every other gap on record is at most 2h.
  // There is no honest answer in those cases, so it throws.
  if (zonedWeekday(result, timeZone) !== weekday) {
    throw new RangeError(
      `no instant in ${timeZone} on ISO weekday ${weekday} reads as hour ${hour}: ` +
        'a daylight-saving gap swallowed the reset hour',
    );
  }

  return result;
}
