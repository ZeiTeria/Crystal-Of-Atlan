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
  });

  // These three properties fully characterise the function, and unlike
  // hand-computed dates they stay correct across DST transitions.
  it.each([WIB, NY, 'UTC', 'Europe/London'])(
    'always lands on the target weekday and hour in %s',
    (zone) => {
      const base = Date.UTC(2026, 0, 1);
      for (let i = 0; i < 400; i++) {
        for (const weekday of [1, 4]) {
          const now = new Date(base + i * 86_400_000 + (i * 3_600_000) % 86_400_000);
          const got = lastReset(weekday, 4, zone, now);

          expect(zonedWeekday(got, zone)).toBe(weekday);
          expect(partsIn(got, zone)).toEqual({ hour: 4, minute: 0 });
          expect(got.getTime()).toBeLessThanOrEqual(now.getTime());
          expect(now.getTime() - got.getTime()).toBeLessThan(7 * 86_400_000);
        }
      }
    },
  );
});
