import { describe, expect, it } from 'vitest';
import { buildPlanInput, type PlanRows } from './loadPlanInput';
import type { Database } from '../lib/database.types';

type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

// Fixed week: resets fire at 04:00 UTC, so with `NOW` on Friday the Monday
// boundary is 08-31T04:00Z and the Thursday boundary is 09-03T04:00Z.
const NOW = new Date('2026-09-04T12:00:00Z');

const SETTINGS: Row<'app_settings'> = {
  id: true,
  gold_cap_per_character: 1000,
  gold_reset_weekday: 1,
  reset_hour: 4,
  server_timezone: 'UTC',
};

function aCharacterRow(id: string): Row<'characters'> {
  return { id, game_account_id: 'acc', name: id.toUpperCase(), class: null, sort_order: 0 };
}

function aDungeonRow(id: string, overrides: Partial<Row<'dungeons'>> = {}): Row<'dungeons'> {
  return {
    id,
    name: id.toUpperCase(),
    account_attempts: 18,
    character_attempts: 3,
    reset_weekday: 1,
    quest_coverage: false,
    gold_solo: 10,
    gold_story: 20,
    gold_elite: 30,
    gold_legend: 40,
    sort_order: 0,
    is_active: true,
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
    ...overrides,
  };
}

function aRunRow(
  characterId: string,
  dungeonId: string,
  ranAt: string,
  goldEarned = 0,
): Row<'runs'> {
  return {
    id: `${characterId}-${dungeonId}-${ranAt}`,
    character_id: characterId,
    dungeon_id: dungeonId,
    ran_at: ranAt,
    gold_earned: goldEarned,
  };
}

function rows(parts: Partial<Omit<PlanRows, 'settings'>> = {}): PlanRows {
  return {
    settings: SETTINGS,
    characters: parts.characters ?? [],
    dungeons: parts.dungeons ?? [],
    grid: parts.grid ?? [],
    runs: parts.runs ?? [],
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
      NOW,
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
      NOW,
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
      NOW,
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
            quest_coverage: true,
            gold_solo: 1,
            gold_story: 2,
            gold_elite: 3,
            gold_legend: 4,
          }),
        ],
      }),
      NOW,
    );

    expect(input.dungeons).toEqual([
      {
        id: 'd1',
        name: 'Sunken Vault',
        accountAttempts: 18,
        characterAttempts: 2,
        resetWeekday: 4,
        questCoverage: true,
        gold: { solo: 1, story: 2, elite: 3, legend: 4 },
      },
    ]);
  });

  it('counts each dungeon from its own reset, not a shared one', () => {
    // Wednesday sits after the Monday boundary but before the Thursday one, so
    // the same instant is inside one week and outside the other.
    const wednesday = '2026-09-02T12:00:00Z';
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1')],
        dungeons: [
          aDungeonRow('mon', { reset_weekday: 1 }),
          aDungeonRow('thu', { reset_weekday: 4 }),
        ],
        grid: [aGridRow('c1', 'mon'), aGridRow('c1', 'thu')],
        runs: [aRunRow('c1', 'mon', wednesday), aRunRow('c1', 'thu', wednesday)],
      }),
      NOW,
    );

    expect(input.accountAttemptsLeft).toEqual({ mon: 17, thu: 18 });
    expect(input.characterAttemptsLeft).toEqual({ c1: { mon: 2, thu: 3 } });
  });

  it('reduces gold headroom by this gold week only', () => {
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1')],
        dungeons: [aDungeonRow('thu', { reset_weekday: 4 })],
        grid: [aGridRow('c1', 'thu')],
        runs: [
          // Before the Monday gold reset: spent, but in the previous gold week.
          aRunRow('c1', 'thu', '2026-08-30T10:00:00Z', 400),
          // After it, and before the Thursday dungeon reset: gold counts even
          // though the attempt no longer does.
          aRunRow('c1', 'thu', '2026-09-02T10:00:00Z', 250),
          aRunRow('c1', 'thu', '2026-09-04T10:00:00Z', 100),
        ],
      }),
      NOW,
    );

    expect(input.goldHeadroom).toEqual({ c1: 650 });
    expect(input.accountAttemptsLeft).toEqual({ thu: 17 });
  });

  it('keeps a character that has no grid row at all', () => {
    const input = buildPlanInput(
      rows({
        characters: [aCharacterRow('c1'), aCharacterRow('c2')],
        dungeons: [aDungeonRow('d1')],
        grid: [aGridRow('c1', 'd1')],
      }),
      NOW,
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
          runs: [aRunRow('c1', 'd1', '2026-09-03T10:00:00Z', 500)],
        }),
        // Gold resets on Thursday here, so the Thursday run is inside the week.
        settings: { ...SETTINGS, gold_cap_per_character: 900, gold_reset_weekday: 4 },
      },
      NOW,
    );

    expect(input.goldHeadroom).toEqual({ c1: 400 });
  });
});
