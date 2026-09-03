import { describe, expect, it } from 'vitest';
import { buildPlanInput, type PlanRows } from './loadPlanInput';
import type { Database } from '../lib/database.types';

type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

const SETTINGS: Row<'app_settings'> = {
  id: true,
  gold_cap_per_character: 1000,
  gold_reset_weekday: 1,
  reset_hour: 4,
  server_timezone: 'UTC',
  stone_rate: 0.4,
};

function aCharacterRow(id: string): Row<'characters'> {
  return { id, game_account_id: 'acc', name: id.toUpperCase(), class: null, sort_order: 0, is_active: true };
}

function aDungeonRow(id: string, overrides: Partial<Row<'dungeons'>> = {}): Row<'dungeons'> {
  return {
    id,
    name: id.toUpperCase(),
    account_attempts: 18,
    character_attempts: 3,
    reset_weekday: 1,
    gold_solo_stone: 0,
    gold_story_stone: 0,
    gold_elite_stone: 0,
    gold_legend_stone: 0,
    manual: false,
    gold_solo: 10,
    gold_story: 20,
    gold_elite: 30,
    gold_legend: 40,
    sort_order: 0,
    is_active: true,
    default_tier: 'elite',
    default_min_runs: 1,
    group_name: null,
    short_name: null,
    ...overrides,
  };
}

function aGridRow(
  characterId: string,
  dungeonId: string,
  overrides: Partial<Row<'character_dungeon'>> = {},
): Row<'character_dungeon'> {
  return {
    character_id: characterId,
    dungeon_id: dungeonId,
    tier: 'elite',
    min_runs: 0,
    max_runs: null,
    ...overrides,
  };
}

function rows(parts: Partial<Omit<PlanRows, 'settings'>> = {}): PlanRows {
  return {
    settings: SETTINGS,
    characters: parts.characters ?? [],
    dungeons: parts.dungeons ?? [],
    grid: parts.grid ?? [],
  };
}

describe('buildPlanInput', () => {
  it('drops a pair the character has not unlocked', () => {
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1')],
        dungeons: [aDungeonRow('d1'), aDungeonRow('d2')],
        grid: [aGridRow('c1', 'd1', { tier: 'none' }), aGridRow('c1', 'd2', { tier: 'solo' })],
      }),
    );

    expect(input.grid).toEqual([
      { characterId: 'c1', dungeonId: 'd2', tier: 'solo', minRuns: 0 },
    ]);
  });

  it('ignores grid rows pointing outside this account', () => {
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1')],
        dungeons: [aDungeonRow('d1')],
        grid: [aGridRow('c1', 'd1'), aGridRow('stranger', 'd1'), aGridRow('c1', 'gone')],
      }),
    );

    expect(input.grid).toEqual([
      { characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 },
    ]);
  });

  it('excludes an inactive dungeon from the catalogue, the grid and the counters', () => {
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1')],
        dungeons: [aDungeonRow('live'), aDungeonRow('retired', { is_active: false })],
        grid: [aGridRow('c1', 'live'), aGridRow('c1', 'retired')],
      }),
    );

    expect(input.dungeons.map((d) => d.id)).toEqual(['live']);
    expect(input.grid.map((g) => g.dungeonId)).toEqual(['live']);
    expect(input.accountAttemptsLeft).toEqual({ live: 18 });
    expect(input.characterAttemptsLeft).toEqual({ c1: { live: 3 } });
  });

  it('maps every catalogue column onto the engine dungeon', () => {
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1')],
        dungeons: [
          aDungeonRow('d1', {
            name: 'Sunken Vault',
            account_attempts: 18,
            character_attempts: 2,
            reset_weekday: 4,
            gold_solo: 1,
            gold_story: 2,
            gold_elite: 3,
            gold_legend: 4,
          }),
        ],
      }),
    );

    expect(input.dungeons).toEqual([
      {
        id: 'd1',
        name: 'Sunken Vault',
        accountAttempts: 18,
        characterAttempts: 2,
        resetWeekday: 4,
        gold: { solo: 1, story: 2, elite: 3, legend: 4 },
        default_tier: 'elite',
        default_min_runs: 1,
        // Display only - carried through so the screens can order and band
        // their columns, never read by the engine.
        sort_order: 0,
        group_name: null,
        short_name: null,
        // Every tier has a figure in this fixture, so nothing was borrowed.
        goldEstimated: [],
        goldUnknown: false,
      },
    ]);
  });

  it('keeps a character that has no grid row at all', () => {
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1'), aCharacterRow('c2')],
        dungeons: [aDungeonRow('d1', { default_tier: 'none' })],
        grid: [{ character_id: 'c1', dungeon_id: 'd1', tier: 'legend', min_runs: 0, max_runs: null }],
      }),
    );

    expect(input.characters.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(input.grid.map((g) => g.characterId)).toEqual(['c1']);
    expect(input.characterAttemptsLeft).toEqual({ c1: { d1: 3 }, c2: { d1: 3 } });
    expect(input.goldHeadroom).toEqual({ c1: 1000, c2: 1000 });
  });

  it('reads the gold cap and reset weekday from settings', () => {
    const input = buildPlanInput(
      {
        ...rows({
          characters: [aCharacterRow('c1')],
          dungeons: [aDungeonRow('d1')],
        }),
        settings: { ...SETTINGS, gold_cap_per_character: 900, gold_reset_weekday: 4 },
      },
    );

    expect(input.goldHeadroom).toEqual({ c1: 900 });
    // Nothing derived from the weekday is observable now that runs are gone,
    // but the Countdown still reads it, so keep it pinned end to end.
    expect(input.settings.goldResetWeekday).toBe(4);
  });
});
