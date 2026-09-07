import { describe, expect, it } from 'vitest';
import { solveOptimal } from './solver';
import { aCharacter, aDungeon, anInput } from './testing/build';

describe('solveOptimal', () => {
  it('fills the gold cap exactly rather than grabbing the biggest run', async () => {
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
    const result = await solveOptimal(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.gold).toBe(1_000_000);
  });

  it('reaches characters x 1,000,000 when that ceiling is actually achievable', async () => {
    // Four characters, each able to earn exactly 1,000,000 from two dungeons.
    const characters = ['c1', 'c2', 'c3', 'c4'].map((id) => aCharacter(id));
    const dungeons = [
      aDungeon('a', { accountAttempts: 8, characterAttempts: 2,
        gold: { solo: 0, story: 0, elite: 300_000, legend: 0 } }),
      aDungeon('b', { accountAttempts: 8, characterAttempts: 2,
        gold: { solo: 0, story: 0, elite: 200_000, legend: 0 } }),
    ];
    const grid = characters.flatMap((c) =>
      dungeons.map((d) => ({
        characterId: c.id, dungeonId: d.id, tier: 'elite' as const, minRuns: 0,
      })),
    );
    const result = await solveOptimal(anInput({ characters, dungeons, grid }));
    if (result.status !== 'optimal') throw new Error('expected optimal');
    // 2 x 300k + 2 x 200k = 1,000,000 each, x4 characters.
    expect(result.totals.gold).toBe(4_000_000);
  });

  it('returns the true lower optimum when the ceiling is not reachable', async () => {
    // One character, one dungeon, 3 runs at 300k. The 1,000,000 cap cannot be
    // filled: 900,000 is the real answer and the solver must say so.
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { accountAttempts: 18, characterAttempts: 3,
        gold: { solo: 0, story: 0, elite: 300_000, legend: 0 } })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }],
    });
    const result = await solveOptimal(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.gold).toBe(900_000);
    expect(result.totals.attempts).toBe(3);
  });

  it('reports infeasible rather than dropping an impossible minimum', async () => {
    const input = anInput({
      characters: [aCharacter('c1')],
      dungeons: [aDungeon('d1', { characterAttempts: 3 })],
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 4 }],
    });
    const result = await solveOptimal(input);
    expect(result.status).toBe('infeasible');
    if (result.status !== 'infeasible') throw new Error('unreachable');
    expect(result.conflicts).toContainEqual({
      kind: 'minimum-exceeds-character-cap', characterId: 'c1', dungeonId: 'd1',
      required: 4, available: 3,
    });
  });

  it('handles an empty problem without crashing', async () => {
    const result = await solveOptimal(anInput({ characters: [], dungeons: [], grid: [] }));
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals).toEqual({ attempts: 0, gold: 0 });
  });

  it('two characters on the same dungeon with different buffs get different goldPerRun', async () => {
    const input = anInput({
      characters: [
        aCharacter('unbuffed', { buffPct: 0 }),
        aCharacter('buffed', { buffPct: 0.17 }),
      ],
      dungeons: [
        aDungeon('d1', { gold: { solo: 0, story: 0, elite: 100_000, legend: 0 }, goldC: 50_000 }),
      ],
      grid: [
        { characterId: 'unbuffed', dungeonId: 'd1', tier: 'elite', minRuns: 1, maxRuns: 1 },
        { characterId: 'buffed', dungeonId: 'd1', tier: 'elite', minRuns: 1, maxRuns: 1 },
      ],
    });
    
    // With maxRuns: 1 for both, they each run exactly once.
    // unbuffed: 100,000 + 0 * 50,000 = 100,000
    // buffed: 100,000 + 0.17 * 50,000 = 108,500
    // total = 208,500
    const result = await solveOptimal(input);
    if (result.status !== 'optimal') throw new Error('expected optimal');
    expect(result.totals.gold).toBe(208_500);

    const unbuffedAssignment = result.assignments.find(a => a.characterId === 'unbuffed');
    const buffedAssignment = result.assignments.find(a => a.characterId === 'buffed');
    expect(unbuffedAssignment?.goldPerRun).toBe(100_000);
    expect(buffedAssignment?.goldPerRun).toBe(108_500);
  });
});
