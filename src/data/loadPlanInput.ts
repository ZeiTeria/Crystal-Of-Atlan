import { derivePlanInput, type Settings } from '../engine/counters';
import type { Character, Dungeon, GridEntry, PlanInput } from '../engine/types';
import { fillGoldGaps } from '../engine/gold';
import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';

type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/** The rows one account's plan is derived from, exactly as the tables store them. */
export interface PlanRows {
  settings: Row<'app_settings'>;
  characters: Row<'characters'>[];
  dungeons: Row<'dungeons'>[];
  grid: Row<'character_dungeon'>[];
}

export function toSettings(row: Row<'app_settings'>): Settings {
  return {
    goldCap: row.gold_cap_per_character,
    goldResetWeekday: row.gold_reset_weekday,
    resetHour: row.reset_hour,
    timeZone: row.server_timezone,
  };
}

/**
 * Maps stored rows onto the engine's own shapes. Pure, so it is testable
 * without the network — every counter it reports is `derivePlanInput`'s work,
 * not this module's.
 */
export function buildPlanInput(rows: PlanRows): PlanInput {
  const characters: Character[] = rows.characters
    .filter((c) => c.is_active !== false)
    .map((c) => ({ id: c.id, name: c.name, class: c.class }));

  // An inactive dungeon is retired from planning, so it must not appear in the
  // catalogue, the grid, or any counter derived from them.
  const dungeons: Dungeon[] = rows.dungeons
    .filter((d) => d.is_active)
    .map((d) => ({
      id: d.id,
      name: d.name,
      accountAttempts: d.account_attempts,
      characterAttempts: d.character_attempts,
      resetWeekday: d.reset_weekday,
      ...(() => {
        // Missing figures borrow from the tiers that have one, so a half-filled
        // catalogue still plans sensibly. Which ones were guessed is carried
        // through so the screens can flag them.
        const { gold, estimated, unknown } = fillGoldGaps({
          solo: d.gold_solo,
          story: d.gold_story,
          elite: d.gold_elite,
          legend: d.gold_legend,
        });
        return { gold, goldEstimated: estimated, goldUnknown: unknown };
      })(),
      default_tier: d.default_tier,
      default_min_runs: d.default_min_runs,
      sort_order: d.sort_order,
      group_name: d.group_name,
      short_name: d.short_name,
    }));

  // Merge explicit grid rows over the dungeons' default tiers.
  const explicitGrid = new Map<string, Pick<GridEntry, 'tier' | 'minRuns'>>();
  for (const g of rows.grid) {
    explicitGrid.set(`${g.character_id}|${g.dungeon_id}`, {
      tier: g.tier,
      minRuns: g.min_runs,
    });
  }

  const grid: GridEntry[] = [];
  for (const character of characters) {
    for (const dungeon of dungeons) {
      const explicit = explicitGrid.get(`${character.id}|${dungeon.id}`);
      const tier = explicit?.tier ?? dungeon.default_tier;
      // tier `none` means not unlocked; the pair is dropped entirely
      if (tier !== 'none') {
        grid.push({
          characterId: character.id,
          dungeonId: dungeon.id,
          tier,
          minRuns: explicit?.minRuns ?? dungeon.default_min_runs,
        });
      }
    }
  }

  return derivePlanInput({
    characters,
    dungeons,
    grid,
    settings: toSettings(rows.settings),
  });
}


/**
 * One account's stored state: what the engine needs, and the rows it came from.
 *
 * The rows are returned as well as the derived input because the SCREENS need
 * what the engine deliberately drops - parked characters, and grid rows whose
 * tier is `none`. Reading them separately meant fetching characters, the grid
 * and the settings twice on every refresh, and a refresh follows every write.
 */
export interface PlanState {
  input: PlanInput;
  settings: Row<'app_settings'>;
  /** Every character on the account, parked included. */
  characters: Row<'characters'>[];
  /** The stored grid rows, `none` tiers included. */
  grid: Row<'character_dungeon'>[];
}

/**
 * Reads one account's stored state and hands the finished engine its input.
 *
 * Row level security is what scopes this to the signed-in user; the account id
 * only picks which of their accounts to plan. An account they do not own simply
 * returns no characters.
 */
export async function loadPlanState(gameAccountId: string): Promise<PlanState> {
  const [settingsResult, charactersResult, dungeonsResult] = await Promise.all([
    supabase.from('app_settings').select('*').eq('id', true).single(),
    supabase
      .from('characters')
      .select('*')
      .eq('game_account_id', gameAccountId)
      .order('sort_order')
      .order('id'),
    supabase.from('dungeons').select('*').eq('is_active', true).order('sort_order').order('id'),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (charactersResult.error) throw charactersResult.error;
  if (dungeonsResult.error) throw dungeonsResult.error;

  const settingsRow = settingsResult.data;
  const characters = charactersResult.data;
  const dungeons = dungeonsResult.data;
  const characterIds = characters.map((c) => c.id);

  // No characters means no grid and no runs to ask for, and `in ()` with an
  // empty list is a query the client should never have to send.
  if (characterIds.length === 0) {
    return {
      input: buildPlanInput({ settings: settingsRow, characters, dungeons, grid: [] }),
      settings: settingsRow,
      characters,
      grid: [],
    };
  }

  const gridResult = await supabase
    .from('character_dungeon')
    .select('*')
    .in('character_id', characterIds);

  if (gridResult.error) throw gridResult.error;

  return {
    input: buildPlanInput({
      settings: settingsRow,
      characters,
      dungeons,
      grid: gridResult.data,
    }),
    settings: settingsRow,
    characters,
    grid: gridResult.data,
  };
}
