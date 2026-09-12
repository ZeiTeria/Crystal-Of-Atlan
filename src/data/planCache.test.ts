import { describe, expect, it } from 'vitest';
import { planFingerprint } from './planCache';
import { aCharacter, aDungeon, anInput } from '../engine/testing/build';
import type { PlanInput } from '../engine/types';

function base(): PlanInput {
  return anInput({
    characters: [aCharacter('c1', { buffPct: 0.02 }), aCharacter('c2')],
    dungeons: [aDungeon('d1', { goldC: 50_000 }), aDungeon('d2')],
    grid: [
      { characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 1 },
      { characterId: 'c1', dungeonId: 'd2', tier: 'story', minRuns: 0 },
      { characterId: 'c2', dungeonId: 'd1', tier: 'elite', minRuns: 1 },
    ],
  });
}

/** Fingerprints of `base()` and of `base()` with one thing changed. */
async function pair(change: (input: PlanInput) => PlanInput) {
  return Promise.all([planFingerprint(base()), planFingerprint(change(base()))]);
}

describe('planFingerprint', () => {
  it('is stable for the same input', async () => {
    const [a, b] = await pair((i) => i);
    expect(a).toBe(b);
  });

  it('does not depend on the order rows came back in', async () => {
    const [a, b] = await pair((i) => ({ ...i, grid: [...i.grid].reverse() }));
    expect(a).toBe(b);
  });

  it('ignores a rename, which cannot change the plan', async () => {
    const [a, b] = await pair((i) => ({
      ...i,
      characters: i.characters.map((c) => ({ ...c, name: 'Renamed', class: 'Sugariff' })),
      dungeons: i.dungeons.map((d) => ({ ...d, name: 'Renamed', short_name: 'RN' })),
    }));
    expect(a).toBe(b);
  });

  // Everything the solver actually reads has to move it, or the screen serves a
  // stale plan. One case per input.
  const changes: [string, (i: PlanInput) => PlanInput][] = [
    ['a buff toggle', (i) => ({
      ...i,
      characters: i.characters.map((c) => (c.id === 'c2' ? { ...c, buffPct: 0.12 } : c)),
    })],
    ['C on a dungeon someone runs', (i) => ({
      ...i,
      dungeons: i.dungeons.map((d) => (d.id === 'd1' ? { ...d, goldC: 20_000 } : d)),
    })],
    ['a gold figure', (i) => ({
      ...i,
      dungeons: i.dungeons.map((d) =>
        d.id === 'd1' ? { ...d, gold: { ...d.gold, elite: 999 } } : d),
    })],
    ['a minimum', (i) => ({
      ...i,
      grid: i.grid.map((g) => (g.dungeonId === 'd2' ? { ...g, minRuns: 2 } : g)),
    })],
    ['a maximum', (i) => ({
      ...i,
      grid: i.grid.map((g) => (g.dungeonId === 'd1' ? { ...g, maxRuns: 1 } : g)),
    })],
    ['a tier', (i) => ({
      ...i,
      grid: i.grid.map((g) => (g.dungeonId === 'd1' ? { ...g, tier: 'story' as const } : g)),
    })],
    ['a minimum on a locked dungeon', (i) => ({
      ...i,
      grid: [...i.grid, { characterId: 'c2', dungeonId: 'd2', tier: 'none', minRuns: 1, maxRuns: 3 }],
    })],
    ['a character leaving', (i) => ({ ...i, characters: i.characters.slice(0, 1) })],
    ['the account attempt cap', (i) => ({
      ...i, accountAttemptsLeft: { ...i.accountAttemptsLeft, d1: 6 },
    })],
    ['the character attempt cap', (i) => ({
      ...i,
      characterAttemptsLeft: {
        ...i.characterAttemptsLeft,
        c1: { ...i.characterAttemptsLeft.c1, d1: 1 },
      },
    })],
    ['the gold cap', (i) => ({ ...i, goldHeadroom: { ...i.goldHeadroom, c1: 500_000 } })],
  ];

  for (const [label, change] of changes) {
    it(`changes when ${label} changes`, async () => {
      const [a, b] = await pair(change);
      expect(b).not.toBe(a);
    });
  }
});
