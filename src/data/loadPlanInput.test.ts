import { describe, expect, it } from 'vitest';
import { buildPlanInput, type PlanRows } from './loadPlanInput';
import { buildCells } from '../engine/cells';
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
  abnormal_sense: false,
};

function aCharacterRow(id: string): Row<'characters'> {
  return { id, game_account_id: 'acc', name: id.toUpperCase(), class: null, sort_order: 0, is_active: true, has_title: false, has_potion: false };
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
    gold_c: 0,
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
      { characterId: 'c1', dungeonId: 'd2', tier: 'solo', minRuns: 0, maxRuns: 3 },
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
      { characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0, maxRuns: 3 },
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
        goldC: 0,
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
        manual: false,
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

describe('stone gold', () => {
  const goldOf = (d: Partial<Row<'dungeons'>>) =>
    buildPlanInput(
      rows({ characters: [aCharacterRow('c1')], dungeons: [aDungeonRow('d1', d)] }),
    ).dungeons[0]?.gold;

  it('leaves a tier at its base when no stone figure is entered', () => {
    // A blank stone field stores 0. Without the clamp, 0 - base is negative and
    // the dungeon would price BELOW its own base.
    expect(goldOf({ gold_elite: 30 })?.elite).toBe(30);
  });

  it('never prices a tier below its base when the stone figure is lower', () => {
    // A typo, rather than a real bonus.
    expect(goldOf({ gold_elite: 30, gold_elite_stone: 5 })?.elite).toBe(30);
  });

  it('blends the bonus at the configured rate, rounded to whole gold', () => {
    // bonus 101 at rate 0.4 is 40.4, so the tier is worth 70.4 before
    // rounding. Gold must stay integral: the LP renderer states its
    // coefficients are always integers, and assertFeasible re-checks the plan
    // in integer arithmetic.
    const gold = goldOf({ gold_elite: 30, gold_elite_stone: 131 })?.elite;
    expect(gold).toBe(70);
    expect(Number.isInteger(gold)).toBe(true);
  });

  it('carries the bonus onto a tier whose base was borrowed', () => {
    // The Deep Dive in the live catalogue: elite is entered with its stone
    // figure, legend is blank. `fillGoldGaps` hands legend elite's base, but
    // gold_legend_stone stays 0 - so reading the bonus per tier left legend
    // pricing BELOW elite (75,000 against 77,000) on a dungeon where the two
    // tiers are known to pay identically.
    const gold = goldOf({
      gold_solo: 0,
      gold_story: 0,
      gold_elite: 75000,
      gold_legend: 0,
      gold_elite_stone: 80000,
    });
    expect(gold?.elite).toBe(77000);
    expect(gold?.legend).toBe(77000);
  });

  it('applies one bonus across every tier, not one per tier', () => {
    // Measured: the bonus is a property of the dungeon, identical at story
    // and elite on both dungeons where both are known.
    const gold = goldOf({
      gold_solo: 0,
      gold_story: 40000,
      gold_story_stone: 45000,
      gold_elite: 50000,
      gold_legend: 0,
    });
    expect(gold?.story).toBe(42000);
    expect(gold?.elite).toBe(52000);
  });

  it('leaves a dungeon alone when no tier has both figures', () => {
    // Nothing to borrow. An invented bonus would be worse than none.
    expect(goldOf({ gold_solo: 0, gold_story: 0, gold_elite: 50000, gold_legend: 0 })?.elite).toBe(50000);
  });
});

describe('max runs', () => {
  const maxOf = (max: number | null) =>
    buildPlanInput(
      rows({
        characters: [aCharacterRow('c1')],
        dungeons: [aDungeonRow('d1')],           // character_attempts: 3
        grid: [aGridRow('c1', 'd1', { max_runs: max })],
      }),
    ).grid[0]?.maxRuns;

  it('inherits the dungeon cap when no maximum is stored', () => {
    expect(maxOf(null)).toBe(3);
  });

  it('clamps a stored maximum above the dungeon cap', () => {
    // Lowering a dungeon's cap must not leave a stale higher figure in play.
    expect(maxOf(99)).toBe(3);
  });

  it('keeps a stored maximum below the cap', () => {
    expect(maxOf(1)).toBe(1);
  });
});

describe('gold buffs', () => {
  const buffPctOf = (
    c: Partial<Row<'characters'>>,
    abnormalSense: boolean = false
  ) => {
    const input = buildPlanInput({
      ...rows({ characters: [{ ...aCharacterRow('c1'), ...c }] }),
      settings: { ...SETTINGS, abnormal_sense: abnormalSense },
    });
    return input.characters[0]?.buffPct;
  };

  const goldOf = (d: Partial<Row<'dungeons'>>) =>
    buildPlanInput(
      rows({ characters: [aCharacterRow('c1')], dungeons: [aDungeonRow('d1', d)] }),
    ).dungeons[0]?.gold;

  it('a dungeon with gold_elite 80500 and gold_c 50000 yields an unbuffed Dungeon.gold.elite of 79500', () => {
    const gold = goldOf({ gold_elite: 80500, gold_c: 50000, gold_elite_stone: 0 });
    expect(gold?.elite).toBe(79500);
  });

  it('a character with has_title true and has_potion false gets buffPct 0.02', () => {
    expect(buffPctOf({ has_title: true, has_potion: false })).toBe(0.02);
  });

  it('with both plus abnormal_sense on, 0.17 EXACTLY', () => {
    expect(buffPctOf({ has_title: true, has_potion: true }, true)).toBe(0.17);
  });
});


describe('buffs and the plan', () => {
  const buffedDungeon = {
    gold_solo: 0,
    gold_story: 0,
    gold_elite: 80500,
    gold_legend: 0,
    gold_elite_stone: 85500,
    gold_c: 50000,
  };

  const priceFor = (c: Partial<Row<'characters'>>, abnormalSense = false) => {
    const input = buildPlanInput({
      ...rows({
        characters: [{ ...aCharacterRow('c1'), ...c }],
        dungeons: [aDungeonRow('d1', buffedDungeon)],
      }),
      settings: { ...SETTINGS, abnormal_sense: abnormalSense },
    });
    return buildCells(input).find((cell) => cell.dungeonId === 'd1')?.goldPerRun;
  };

  it('prices a migration-default character at exactly the stored catalogue figure', () => {
    // THE invariant of this whole change. Every gold figure in the catalogue was
    // recorded with the 2% title active, which is why the migration defaults
    // has_title to true. So on the day it is applied, before anyone touches a
    // toggle, gold per run must not move: the title that loadPlanInput subtracts
    // is added straight back by the character's own buffPct.
    //
    // 80,500 stored, plus 0.4 of the 5,000 stone bonus, is what the old code
    // priced this run at. If this number ever changes, every existing plan has
    // silently re-priced.
    expect(priceFor({ has_title: true })).toBe(82500);
  });

  it('drops the run to its unbuffed worth when the title is off', () => {
    // 2% of C = 50,000 is 1,000, so an untitled character earns exactly that less.
    expect(priceFor({ has_title: false })).toBe(81500);
  });

  it('adds each buff as a percentage of C, not of the whole reward', () => {
    // 17% of 50,000 is 8,500 - not 17% of 82,500, which would be 14,025.
    expect(priceFor({ has_title: true, has_potion: true }, true)).toBe(90000);
  });

  it('prices the same dungeon differently for two characters', () => {
    // Gold per run stopped being a property of the dungeon alone. If buildCells
    // ever reverts to reading dungeon.gold directly, these two collapse to one
    // number and the whole feature is silently dead.
    const input = buildPlanInput({
      ...rows({
        characters: [
          { ...aCharacterRow('c1'), has_title: true, has_potion: true },
          { ...aCharacterRow('c2'), has_title: false, has_potion: false },
        ],
        dungeons: [aDungeonRow('d1', buffedDungeon)],
      }),
    });
    const cells = buildCells(input);
    expect(cells.find((c) => c.characterId === 'c1')?.goldPerRun).toBe(87500);
    expect(cells.find((c) => c.characterId === 'c2')?.goldPerRun).toBe(81500);
  });
});
