import { describe, expect, it } from 'vitest';
import { validate } from './validate';
import { aCharacter, aDungeon, anInput } from './testing/build';

describe('validate', () => {
  it('accepts a satisfiable set of minimums', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3 })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 3 }],
    });
    expect(validate(input)).toEqual([]);
  });

  it('rejects a minimum on a dungeon the character has not unlocked', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1')],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'none', minRuns: 1 }],
    });
    expect(validate(input)).toEqual([
      { kind: 'minimum-on-locked-dungeon', characterId: 'c1', dungeonId: 'd1' },
    ]);
  });

  it('rejects a minimum above what that character has left', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { characterAttempts: 3 })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 4 }],
    });
    expect(validate(input)).toEqual([
      { kind: 'minimum-exceeds-character-cap', characterId: 'c1', dungeonId: 'd1',
        required: 4, available: 3 },
    ]);
  });

  it('rejects minimums that together exceed the account cap', () => {
    const characters = ['c1', 'c2', 'c3'].map(aCharacter);
    const input = anInput({
      characters,
      dungeons: [aDungeon('d1', { accountAttempts: 5, characterAttempts: 3 })],
      grid: characters.map((c) => ({
        characterId: c.id, dungeonId: 'd1', tier: 'elite' as const, minRuns: 3,
      })),
      accountAttemptsLeft: { d1: 5 },
    });
    expect(validate(input)).toEqual([
      { kind: 'minimums-exceed-account-cap', dungeonId: 'd1', required: 9, available: 5 },
    ]);
  });

  it('rejects minimums whose gold exceeds the character headroom', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { gold: { solo: 0, story: 0, elite: 400_000, legend: 0 } })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 3 }],
      goldHeadroom: { c1: 1_000_000 },
    });
    expect(validate(input)).toEqual([
      { kind: 'minimums-exceed-gold-cap', characterId: 'c1',
        requiredGold: 1_200_000, headroom: 1_000_000 },
    ]);
  });

  it('reports every conflict at once rather than stopping at the first', () => {
    const input = anInput({
      characters: [aCharacter('c1'), aCharacter('c2')],
      dungeons: [aDungeon('d1', { characterAttempts: 3 })],
      grid: [
        { characterId: 'c1', dungeonId: 'd1', tier: 'none', minRuns: 1 },
        { characterId: 'c2', dungeonId: 'd1', tier: 'elite', minRuns: 9 },
      ],
    });
    expect(validate(input)).toHaveLength(2);
  });
});
