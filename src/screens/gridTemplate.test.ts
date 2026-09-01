import { describe, expect, it } from 'vitest';
import { templateCells, TIER_TEMPLATES } from './gridTemplate';

const dungeons = [
  { id: 'd1', default_tier: 'elite' as const, default_min_runs: 1 },
  { id: 'd2', default_tier: 'none' as const, default_min_runs: 0 },
];

describe('TIER_TEMPLATES', () => {
  it('offers one per paying tier, strongest first', () => {
    expect(TIER_TEMPLATES.map((t) => t.value)).toEqual([
      'tier:legend',
      'tier:elite',
      'tier:story',
      'tier:solo',
    ]);
    expect(TIER_TEMPLATES[0]?.label).toBe('All legend');
  });
});

describe('templateCells', () => {
  const stored = new Map([['src:d1', { tier: 'legend' as const, min_runs: 3 }]]);
  const lookup = (c: string, d: string) => stored.get(`${c}:${d}`);

  it('writes nothing for a blank template, so the character follows the catalogue', () => {
    // A pair with no row already shows the dungeon's defaults. Writing them out
    // would freeze today's values and stop it following a later change.
    expect(templateCells('blank', { targetId: 'new', dungeons, lookup })).toEqual([]);
  });

  it('sets every dungeon to the chosen tier, keeping each dungeon default minimum', () => {
    expect(templateCells('tier:legend', { targetId: 'new', dungeons, lookup })).toEqual([
      { character_id: 'new', dungeon_id: 'd1', tier: 'legend', min_runs: 1 },
      { character_id: 'new', dungeon_id: 'd2', tier: 'legend', min_runs: 0 },
    ]);
  });

  it('copies what a character displays, not only its stored rows', () => {
    expect(templateCells('char:src', { targetId: 'new', dungeons, lookup })).toEqual([
      // d1 is stored on the source.
      { character_id: 'new', dungeon_id: 'd1', tier: 'legend', min_runs: 3 },
      // d2 is not, so it takes the dungeon's own defaults.
      { character_id: 'new', dungeon_id: 'd2', tier: 'none', min_runs: 0 },
    ]);
  });

  it('refuses to copy a character onto itself', () => {
    expect(templateCells('char:new', { targetId: 'new', dungeons, lookup })).toEqual([]);
  });

  it('ignores a tier that is not a paying one', () => {
    expect(templateCells('tier:none', { targetId: 'new', dungeons, lookup })).toEqual([]);
    expect(templateCells('tier:nonsense', { targetId: 'new', dungeons, lookup })).toEqual([]);
  });

  it('ignores a value it does not recognise rather than writing something wrong', () => {
    expect(templateCells('something-else', { targetId: 'new', dungeons, lookup })).toEqual([]);
    expect(templateCells('', { targetId: 'new', dungeons, lookup })).toEqual([]);
  });

  it('handles an empty catalogue', () => {
    expect(templateCells('tier:elite', { targetId: 'new', dungeons: [], lookup })).toEqual([]);
  });
});
