import { describe, expect, it } from 'vitest';
import { aDungeon } from '../engine/testing/build';
import { manualDaysLeft, manualWarning } from './manualPace';

const SETTINGS = {
  goldCap: 1_000_000,
  goldResetWeekday: 1,
  resetHour: 6,
  timeZone: 'UTC',
};

// Friday. The next Monday 06:00 reset is 2d 18h away, which floors to 2.
const FRIDAY = new Date('2026-09-04T12:00:00Z');

describe('manualDaysLeft', () => {
  it('leaves a time-skippable dungeon out of the map entirely', () => {
    const days = manualDaysLeft([aDungeon('d1', { resetWeekday: 1 })], SETTINGS, FRIDAY);
    expect(days.has('d1')).toBe(false);
  });

  it('floors the days left before a manual dungeon resets', () => {
    // 2d 18h left, not 3 days: a warning that fires slightly early costs a
    // glance, one that fires late costs the runs.
    const days = manualDaysLeft(
      [aDungeon('d1', { resetWeekday: 1, manual: true })],
      SETTINGS,
      FRIDAY,
    );
    expect(days.get('d1')).toBe(2);
  });
});

describe('manualWarning', () => {
  it('says nothing for a dungeon that is not manual', () => {
    expect(manualWarning(undefined, 99)).toBeNull();
  });

  it('says nothing while the runs still fit in the days left', () => {
    expect(manualWarning(2, 2)).toBeNull();
  });

  it('warns when more runs are planned than there are days to make them', () => {
    const warning = manualWarning(2, 3);
    expect(warning).toContain('2d');
    expect(warning).toContain('3 runs');
  });
});
