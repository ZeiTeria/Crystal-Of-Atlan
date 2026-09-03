import { describe, expect, it } from 'vitest';
import { solveExhaustive } from './oracle';
import { aCharacter, aDungeon, anInput } from './testing/build';

describe('solveExhaustive', () => {
  it('spends every attempt when nothing is contested', () => {
    const input = anInput({
      characters: [aCharacter('c1'), aCharacter('c2')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3 })],
      grid: [
        { characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 },
        { characterId: 'c2', dungeonId: 'd1', tier: 'elite', minRuns: 0 },
      ],
    });
    const result = solveExhaustive(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.attempts).toBe(6);   // 2 characters x 3, account cap not reached
    expect(result.totals.gold).toBe(6 * 30);
  });

  it('gives contested attempts to the richer character', () => {
    const input = anInput({
      characters: [aCharacter('rich'), aCharacter('poor')],
      dungeons: [aDungeon('d1', {
        accountAttempts: 3, characterAttempts: 3,
        gold: { solo: 1, story: 10, elite: 100, legend: 1000 },
      })],
      grid: [
        { characterId: 'rich', dungeonId: 'd1', tier: 'legend', minRuns: 0 },
        { characterId: 'poor', dungeonId: 'd1', tier: 'solo', minRuns: 0 },
      ],
    });
    const result = solveExhaustive(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.attempts).toBe(3);
    expect(result.totals.gold).toBe(3000);
  });

  // The case a greedy "take the richest first" loop gets wrong.
  it('fills the gold cap exactly rather than grabbing the biggest run', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [
        aDungeon('big', { accountAttempts: 9, characterAttempts: 3,
          gold: { solo: 0, story: 0, elite: 600_000, legend: 0 } }),
        aDungeon('mid', { accountAttempts: 9, characterAttempts: 3,
          gold: { solo: 0, story: 0, elite: 500_000, legend: 0 } }),
      ],
      grid: [
        { characterId: 'c1', dungeonId: 'big', tier: 'elite', minRuns: 0 },
        { characterId: 'c1', dungeonId: 'mid', tier: 'elite', minRuns: 0 },
      ],
    });
    const result = solveExhaustive(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    // Two 500k runs beat one 600k run. Greedy would stop at 600,000.
    expect(result.totals.gold).toBe(1_000_000);
  });

  it('breaks ties on gold by preferring more attempts', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [
        aDungeon('paying', { accountAttempts: 1, characterAttempts: 1,
          gold: { solo: 0, story: 0, elite: 1000, legend: 0 } }),
        aDungeon('cheap', { accountAttempts: 1, characterAttempts: 1,
          gold: { solo: 0, story: 0, elite: 0, legend: 0 } }),
      ],
      grid: [
        { characterId: 'c1', dungeonId: 'paying', tier: 'elite', minRuns: 0 },
        { characterId: 'c1', dungeonId: 'cheap', tier: 'elite', minRuns: 0 },
      ],
    });
    const result = solveExhaustive(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.attempts).toBe(2);
    expect(result.totals.gold).toBe(1000);
  });

  it('honours a hard minimum even when it costs gold', () => {
    const input = anInput({
      characters: [aCharacter('main'), aCharacter('alt')],
      dungeons: [aDungeon('d1', {
        accountAttempts: 3, characterAttempts: 3,
        gold: { solo: 1, story: 1, elite: 100, legend: 1000 },
      })],
      grid: [
        { characterId: 'main', dungeonId: 'd1', tier: 'solo', minRuns: 3 },
        { characterId: 'alt', dungeonId: 'd1', tier: 'legend', minRuns: 0 },
      ],
    });
    const result = solveExhaustive(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.gold).toBe(3);   // forced onto the poor character
  });

  it('reports infeasible when minimums cannot be met', () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { characterAttempts: 3 })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 4 }],
    });
    expect(solveExhaustive(input).status).toBe('infeasible');
  });

  it('never violates a constraint it was given', () => {
    const input = anInput({
      characters: [aCharacter('c1'), aCharacter('c2')],
      dungeons: [aDungeon('d1', {
        accountAttempts: 4, characterAttempts: 3,
        gold: { solo: 0, story: 0, elite: 300, legend: 0 },
      })],
      grid: [
        { characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 },
        { characterId: 'c2', dungeonId: 'd1', tier: 'elite', minRuns: 0 },
      ],
      goldHeadroom: { c1: 600, c2: 1_000_000 },
    });
    const result = solveExhaustive(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');

    const c1 = result.assignments.filter((a) => a.characterId === 'c1');
    expect(c1.reduce((sum, a) => sum + a.goldTotal, 0)).toBeLessThanOrEqual(600);
    expect(result.totals.attempts).toBeLessThanOrEqual(4);
  });
});
