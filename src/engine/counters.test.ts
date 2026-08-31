import { describe, expect, it } from 'vitest';
import { derivePlanInput, type Run, type Settings } from './counters';
import { aCharacter, aDungeon } from './testing/build';

const SETTINGS: Settings = {
  goldCap: 1_000_000,
  goldResetWeekday: 1,   // Monday
  resetHour: 4,
  timeZone: 'Asia/Jakarta',
};

// Wednesday 2026-09-02, 10:00 WIB.
const NOW = new Date('2026-09-02T03:00:00Z');
// Monday 2026-08-31 04:00 WIB — the current gold week began here.
const AFTER_MONDAY_RESET = new Date('2026-08-31T02:00:00Z');
// Saturday 2026-08-29 — before Monday's reset, inside Thursday's window.
const BEFORE_MONDAY_RESET = new Date('2026-08-29T02:00:00Z');

const characters = [aCharacter('c1')];
const monday = aDungeon('mon', { resetWeekday: 1, accountAttempts: 18, characterAttempts: 3 });
const thursday = aDungeon('thu', { resetWeekday: 4, accountAttempts: 18, characterAttempts: 3 });
const grid = [
  { characterId: 'c1', dungeonId: 'mon', tier: 'elite' as const, minRuns: 0 },
  { characterId: 'c1', dungeonId: 'thu', tier: 'elite' as const, minRuns: 0 },
];

const derive = (runs: Run[]) =>
  derivePlanInput({ characters, dungeons: [monday, thursday], grid, runs, settings: SETTINGS, now: NOW });

describe('derivePlanInput', () => {
  it('starts a fresh week at full caps', () => {
    const input = derive([]);
    expect(input.accountAttemptsLeft).toEqual({ mon: 18, thu: 18 });
    expect(input.characterAttemptsLeft.c1).toEqual({ mon: 3, thu: 3 });
    expect(input.goldHeadroom).toEqual({ c1: 1_000_000 });
  });

  it('subtracts runs inside the current window', () => {
    const input = derive([
      { characterId: 'c1', dungeonId: 'mon', ranAt: AFTER_MONDAY_RESET, goldEarned: 250_000 },
    ]);
    expect(input.accountAttemptsLeft.mon).toBe(17);
    expect(input.characterAttemptsLeft.c1?.mon).toBe(2);
    expect(input.goldHeadroom.c1).toBe(750_000);
  });

  it('ignores runs from before the dungeon reset', () => {
    const input = derive([
      { characterId: 'c1', dungeonId: 'mon', ranAt: BEFORE_MONDAY_RESET, goldEarned: 250_000 },
    ]);
    expect(input.accountAttemptsLeft.mon).toBe(18);
    expect(input.characterAttemptsLeft.c1?.mon).toBe(3);
  });

  // The reason each counter has its own window: a Saturday run is expired for
  // the Monday gold cap but still live for a Thursday-reset dungeon.
  it('applies each dungeon window and the gold window independently', () => {
    const input = derive([
      { characterId: 'c1', dungeonId: 'thu', ranAt: BEFORE_MONDAY_RESET, goldEarned: 250_000 },
    ]);
    expect(input.accountAttemptsLeft.thu).toBe(17);      // inside the Thursday window
    expect(input.characterAttemptsLeft.c1?.thu).toBe(2);
    expect(input.goldHeadroom.c1).toBe(1_000_000);       // outside the Monday gold window
  });

  it('never reports negative headroom', () => {
    const input = derive([
      { characterId: 'c1', dungeonId: 'mon', ranAt: AFTER_MONDAY_RESET, goldEarned: 1_500_000 },
    ]);
    expect(input.goldHeadroom.c1).toBe(0);
  });

  it('ignores runs by characters or dungeons that no longer exist', () => {
    const input = derive([
      { characterId: 'ghost', dungeonId: 'mon', ranAt: AFTER_MONDAY_RESET, goldEarned: 100 },
      { characterId: 'c1', dungeonId: 'deleted', ranAt: AFTER_MONDAY_RESET, goldEarned: 100 },
    ]);
    expect(input.accountAttemptsLeft.mon).toBe(18);
    expect(input.goldHeadroom.c1).toBe(1_000_000);
  });
});
