import { describe, expect, it } from 'vitest';
import { lastReset, zonedWeekday } from './resetWindow';

const WIB = 'Asia/Jakarta';       // no DST — exact expectations are safe here
const NY = 'America/New_York';    // has DST — used for the property checks

/** Read an instant back as wall-clock parts in a zone. */
function partsIn(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) p[part.type] = part.value;
  return { hour: Number(p.hour), minute: Number(p.minute) };
}

describe('zonedWeekday', () => {
  it('reads Monday as 1 in the given zone', () => {
    // 2026-08-31 is a Monday. 04:00 WIB = 2026-08-30T21:00Z.
    expect(zonedWeekday(new Date('2026-08-30T21:00:00Z'), WIB)).toBe(1);
  });

  it('can disagree with UTC across the date line', () => {
    // Still Sunday in UTC, already Monday in Jakarta.
    const instant = new Date('2026-08-30T21:00:00Z');
    expect(zonedWeekday(instant, 'UTC')).toBe(7);
    expect(zonedWeekday(instant, WIB)).toBe(1);
  });
});

describe('lastReset', () => {
  it('finds the most recent Monday 04:00 WIB', () => {
    const now = new Date('2026-09-02T03:00:00Z'); // Wed 10:00 WIB
    expect(lastReset(1, 4, WIB, now).toISOString())
      .toBe('2026-08-30T21:00:00.000Z');          // Mon 2026-08-31 04:00 WIB
  });

  it('treats the reset instant itself as the new week', () => {
    const boundary = new Date('2026-08-30T21:00:00.000Z');
    expect(lastReset(1, 4, WIB, boundary).getTime()).toBe(boundary.getTime());
  });

  it('one millisecond earlier still belongs to the previous week', () => {
    const justBefore = new Date('2026-08-30T20:59:59.999Z');
    expect(lastReset(1, 4, WIB, justBefore).toISOString())
      .toBe('2026-08-23T21:00:00.000Z');          // the Monday before
  });

  it('handles a Thursday-reset dungeon independently', () => {
    const now = new Date('2026-09-02T03:00:00Z'); // Wed 10:00 WIB
    // Most recent Thursday 04:00 WIB before that Wednesday is 2026-08-27.
    expect(lastReset(4, 4, WIB, now).toISOString())
      .toBe('2026-08-26T21:00:00.000Z');
  });

  it('rejects out-of-range arguments', () => {
    const now = new Date('2026-09-02T03:00:00Z');
    expect(() => lastReset(0, 4, WIB, now)).toThrow(RangeError);
    expect(() => lastReset(8, 4, WIB, now)).toThrow(RangeError);
    expect(() => lastReset(1, 24, WIB, now)).toThrow(RangeError);
    expect(() => lastReset(1, -1, WIB, now)).toThrow(RangeError);
    expect(() => lastReset(1.5, 4, WIB, now)).toThrow(RangeError);
    expect(() => lastReset(1, 4.5, WIB, now)).toThrow(RangeError);
  });

  it('applies the daylight-saving offset correction on a transition day', () => {
    // 2026-03-08 is the US spring-forward Sunday. A one-step conversion, using
    // only the offset at the naive timestamp, returns 09:00Z = 05:00 EDT — the
    // wrong hour. This case is what makes the correction in
    // zonedWallClockToInstant necessary, and it is pinned here so the guarantee
    // survives any edit to the swept zone list.
    expect(lastReset(7, 4, NY, new Date('2026-03-08T18:00:00Z')).toISOString())
      .toBe('2026-03-08T08:00:00.000Z');
  });

  it('shifts forward out of a daylight-saving gap rather than onto the previous day', () => {
    // Santiago's DST begins at 00:00 on 2026-09-06, so midnight does not exist
    // that day. The boundary must stay on the Sunday, not fall back to Saturday.
    const got = lastReset(7, 0, 'America/Santiago', new Date('2026-09-07T12:00:00Z'));
    expect(zonedWeekday(got, 'America/Santiago')).toBe(7);
  });

  it('keeps the boundary on the requested day when a gap swallows the last hour', () => {
    // America/Godthab begins DST at 23:00, so 23:00 does not exist on the
    // transition Saturday. Forward-shifting out of the gap would land on Sunday
    // 00:00 and report the wrong weekday; the earlier candidate stays on the
    // Saturday. Before the day-preserving choice this call threw a RangeError.
    const got = lastReset(6, 23, 'America/Godthab', new Date('2026-03-29T12:00:00Z'));
    expect(zonedWeekday(got, 'America/Godthab')).toBe(6);
  });

  it('throws when the requested calendar day never existed in the zone', () => {
    // Samoa skipped 2011-12-30 entirely when it crossed the date line, so no
    // instant reads back on that Friday at any hour. This is the only situation
    // that can reach the weekday invariant, and throwing is the honest answer.
    expect(() => lastReset(5, 4, 'Pacific/Apia', new Date('2012-01-05T12:00:00Z')))
      .toThrow(RangeError);
  });

  // These three properties constrain the function — with an 8-day bound on the
  // last one, they do not uniquely pin it — but unlike hand-computed dates they
  // stay correct across DST transitions. Weekday 7 (Sunday) is included because
  // US/EU DST transitions land on Sundays; without it the sweep never touches a
  // transition day and can't tell a correct implementation from a one-step one
  // that skips the offset correction entirely (measured: 15 failures vs 0 with
  // weekday 7 included).
  //
  // The sweep deliberately fixes the hour at 4, which exists in every fixture
  // zone. Sweeping gap hours (2 in America/New_York, 3 in Europe/Athens, 0 in
  // America/Santiago) would fail the "reads back at the target hour" property
  // against CORRECT code, because those wall-clock times genuinely do not exist
  // on a transition day. Gap behaviour is pinned by named tests instead.
  it.each([WIB, NY, 'UTC', 'Europe/London'])(
    'always lands on the target weekday and hour in %s',
    (zone) => {
      const base = Date.UTC(2026, 0, 1);
      for (let i = 0; i < 400; i++) {
        for (const weekday of [1, 4, 7]) {
          const now = new Date(base + i * 86_400_000 + (i * 3_600_000) % 86_400_000);
          const got = lastReset(weekday, 4, zone, now);

          expect(zonedWeekday(got, zone)).toBe(weekday);
          expect(partsIn(got, zone)).toEqual({ hour: 4, minute: 0 });
          expect(got.getTime()).toBeLessThanOrEqual(now.getTime());
          // Not 7 days: across a fall-back week the true interval is 7 days + 1
          // hour. Counterexample: now = 2026-11-02T08:59:59.999Z,
          // lastReset(1, 4, 'America/New_York', now) = 2026-10-26T08:00:00.000Z,
          // which is 7d + 1h - 1ms before now. The one-sample-per-day grid here
          // never lands in that window on the right weekday, so a tighter bound
          // would pass by accident and break under denser sampling.
          expect(now.getTime() - got.getTime()).toBeLessThan(8 * 86_400_000);
        }
      }
    },
  );
});
