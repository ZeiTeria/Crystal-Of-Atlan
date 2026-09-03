import { describe, expect, it } from 'vitest';
import { attemptCeiling, explainCeiling, goldCapCeiling, noContention } from './ceilings';
import { solveExhaustive } from './oracle';
import { aCharacter, aDungeon, anInput } from './testing/build';

describe('goldCapCeiling', () => {
  it('is the sum of every character headroom', () => {
    const input = anInput({
      characters: [aCharacter('c1'), aCharacter('c2')],
      dungeons: [aDungeon('d1')],
      grid: [],
      goldHeadroom: { c1: 1_000_000, c2: 400_000 },
    });
    expect(goldCapCeiling(input)).toBe(1_400_000);
  });
});

describe('attemptCeiling', () => {
  it('gives each dungeon attempts to its best-paying characters', async () => {
    const input = anInput({
      characters: [aCharacter('rich'), aCharacter('poor')],
      dungeons: [aDungeon('d1', {
        accountAttempts: 4, characterAttempts: 3,
        gold: { solo: 10, story: 0, elite: 0, legend: 1000 },
      })],
      grid: [
        { characterId: 'rich', dungeonId: 'd1', tier: 'legend', minRuns: 0 },
        { characterId: 'poor', dungeonId: 'd1', tier: 'solo', minRuns: 0 },
      ],
    });
    // 3 legend runs (cap) + 1 solo run = 3010, ignoring the gold cap.
    expect(await attemptCeiling(input)).toBe(3010);
  });

  it('is a genuine upper bound on the true optimum', async () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3,
        gold: { solo: 0, story: 0, elite: 600_000, legend: 0 } })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }],
    });
    const result = solveExhaustive(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.gold).toBeLessThanOrEqual(await attemptCeiling(input));
    expect(result.totals.gold).toBe(600_000);       // gold cap allows only one run
    expect(await attemptCeiling(input)).toBe(1_800_000);  // attempts alone allow three
  });
  it('respects minimums when assigning attempts', async () => {
    const input = anInput({
      characters: [aCharacter('c1'), aCharacter('c2')],
      dungeons: [aDungeon('d1', {
        accountAttempts: 1, characterAttempts: 3,
        gold: { solo: 10, story: 0, elite: 0, legend: 1000 },
      })],
      grid: [
        { characterId: 'c1', dungeonId: 'd1', tier: 'solo', minRuns: 1 },
        { characterId: 'c2', dungeonId: 'd1', tier: 'legend', minRuns: 0 },
      ],
    });
    // With 1 account attempt and a mandatory run of 10 gold, it shouldn't take 1000.
    expect(await attemptCeiling(input)).toBe(10);
  });
});

describe('noContention', () => {
  it('is true when everyone can run their maximum', () => {
    const input = anInput({
      characters: [aCharacter('c1'), aCharacter('c2')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3,
        gold: { solo: 0, story: 0, elite: 10, legend: 0 } })],
      grid: [
        { characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 },
        { characterId: 'c2', dungeonId: 'd1', tier: 'elite', minRuns: 0 },
      ],
    });
    expect(noContention(input)).toBe(true);
  });

  it('is false when the account cap bites', () => {
    const characters = ['c1', 'c2', 'c3'].map(aCharacter);
    const input = anInput({
      characters,
      dungeons: [aDungeon('d1', { accountAttempts: 5, characterAttempts: 3 })],
      grid: characters.map((c) => ({
        characterId: c.id, dungeonId: 'd1', tier: 'elite' as const, minRuns: 0,
      })),
      accountAttemptsLeft: { d1: 5 },
    });
    expect(noContention(input)).toBe(false);
  });

  // Few characters is NOT enough to be sure there is nothing to decide.
  it('is false when only the gold cap bites', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3,
        gold: { solo: 0, story: 0, elite: 600_000, legend: 0 } })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }],
    });
    expect(noContention(input)).toBe(false);
  });
});

describe('explainCeiling', () => {
  it('names a dungeon whose account attempts ran out', () => {
    const characters = ['c1', 'c2', 'c3'].map(aCharacter);
    const input = anInput({
      characters,
      dungeons: [aDungeon('d1', { accountAttempts: 5, characterAttempts: 3 })],
      grid: characters.map((c) => ({
        characterId: c.id, dungeonId: 'd1', tier: 'elite' as const, minRuns: 0,
      })),
      accountAttemptsLeft: { d1: 5 },
    });
    const reasons = explainCeiling(input, solveExhaustive(input));
    expect(reasons).toContainEqual({ kind: 'account-attempts-exhausted', dungeonId: 'd1' });
  });

  it('names a character that hit the gold cap', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3,
        gold: { solo: 0, story: 0, elite: 500_000, legend: 0 } })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }],
    });
    const reasons = explainCeiling(input, solveExhaustive(input));
    expect(reasons).toContainEqual({ kind: 'gold-cap-reached', characterId: 'c1' });
  });

  it('reports attempts that nobody can use', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3,
        gold: { solo: 0, story: 0, elite: 1, legend: 0 } })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }],
    });
    const reasons = explainCeiling(input, solveExhaustive(input));
    expect(reasons).toContainEqual({
      kind: 'attempts-unusable', dungeonId: 'd1', unusable: 15,
    });
  });
});
