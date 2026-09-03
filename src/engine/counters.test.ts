import { describe, expect, it } from 'vitest';
import { derivePlanInput, type Settings } from './counters';
import { aCharacter, aDungeon } from './testing/build';

const SETTINGS: Settings = {
  goldCap: 1_000_000,
  goldResetWeekday: 1,   // Monday
  resetHour: 6,
  timeZone: 'Asia/Singapore',
};

const characters = [aCharacter('c1')];
const monday = aDungeon('mon', { resetWeekday: 1, accountAttempts: 18, characterAttempts: 3 });
const thursday = aDungeon('thu', { resetWeekday: 4, accountAttempts: 18, characterAttempts: 3 });
const grid = [
  { characterId: 'c1', dungeonId: 'mon', tier: 'elite' as const, minRuns: 0 },
  { characterId: 'c1', dungeonId: 'thu', tier: 'elite' as const, minRuns: 0 },
];

describe('derivePlanInput', () => {
  it('starts every counter at its full weekly allowance', () => {
    const input = derivePlanInput({
      characters,
      dungeons: [monday, thursday],
      grid,
      settings: SETTINGS,
    });
    expect(input.accountAttemptsLeft).toEqual({ mon: 18, thu: 18 });
    expect(input.characterAttemptsLeft.c1).toEqual({ mon: 3, thu: 3 });
    expect(input.goldHeadroom).toEqual({ c1: 1_000_000 });
  });

  it('clamps a negative catalogue figure to zero rather than passing it on', () => {
    const input = derivePlanInput({
      characters,
      dungeons: [aDungeon('bad', { accountAttempts: -5, characterAttempts: -1 })],
      grid: [],
      settings: { ...SETTINGS, goldCap: -1 },
    });
    expect(input.accountAttemptsLeft.bad).toBe(0);
    expect(input.characterAttemptsLeft.c1?.bad).toBe(0);
    expect(input.goldHeadroom.c1).toBe(0);
  });
});
