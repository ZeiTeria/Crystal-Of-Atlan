import { derivePlanInput, type Run, type Settings } from '../engine/counters';
import { lastReset } from '../engine/resetWindow';
import type { Character, Dungeon, GridEntry, PlanInput } from '../engine/types';
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
  runs: Row<'runs'>[];
}

function toSettings(row: Row<'app_settings'>): Settings {
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
export function buildPlanInput(rows: PlanRows, now: Date): PlanInput {
  const characters: Character[] = rows.characters.map((c) => ({ id: c.id, name: c.name }));

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
      questCoverage: d.quest_coverage,
      gold: {
        solo: d.gold_solo,
        story: d.gold_story,
        elite: d.gold_elite,
        legend: d.gold_legend,
      },
    }));

  const characterIds = new Set(characters.map((c) => c.id));
  const dungeonIds = new Set(dungeons.map((d) => d.id));

  // tier `none` is "not unlocked", not "unlocked at zero gold": the pair cannot
  // be run at all, so it is dropped rather than carried as a zero-value option.
  const grid: GridEntry[] = rows.grid
    .filter(
      (g) =>
        g.tier !== 'none' && characterIds.has(g.character_id) && dungeonIds.has(g.dungeon_id),
    )
    .map((g) => ({
      characterId: g.character_id,
      dungeonId: g.dungeon_id,
      tier: g.tier,
      minRuns: g.min_runs,
    }));

  const runs: Run[] = rows.runs.map((r) => ({
    characterId: r.character_id,
    dungeonId: r.dungeon_id,
    ranAt: new Date(r.ran_at),
    goldEarned: r.gold_earned,
  }));

  return derivePlanInput({
    characters,
    dungeons,
    grid,
    runs,
    settings: toSettings(rows.settings),
    now,
  });
}

/**
 * The oldest instant any counter still cares about: each dungeon looks back to
 * its own reset, the gold cap to the global one, so the earliest of them bounds
 * the run log we have to read. Without this the query grows without limit.
 */
function earliestBoundary(
  settings: Settings,
  dungeons: Pick<Row<'dungeons'>, 'reset_weekday'>[],
  now: Date,
): Date {
  const { resetHour, timeZone } = settings;
  const boundaries = [
    lastReset(settings.goldResetWeekday, resetHour, timeZone, now),
    ...dungeons.map((d) => lastReset(d.reset_weekday, resetHour, timeZone, now)),
  ];
  return new Date(Math.min(...boundaries.map((b) => b.getTime())));
}

/**
 * Reads one account's stored state and hands the finished engine its input.
 *
 * Row level security is what scopes this to the signed-in user; the account id
 * only picks which of their accounts to plan. An account they do not own simply
 * returns no characters.
 */
export async function loadPlanInput(
  gameAccountId: string,
  now: Date = new Date(),
): Promise<PlanInput> {
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
    return buildPlanInput({ settings: settingsRow, characters, dungeons, grid: [], runs: [] }, now);
  }

  const since = earliestBoundary(toSettings(settingsRow), dungeons, now);
  const [gridResult, runsResult] = await Promise.all([
    supabase.from('character_dungeon').select('*').in('character_id', characterIds),
    supabase
      .from('runs')
      .select('*')
      .in('character_id', characterIds)
      .gte('ran_at', since.toISOString()),
  ]);

  if (gridResult.error) throw gridResult.error;
  if (runsResult.error) throw runsResult.error;

  return buildPlanInput(
    {
      settings: settingsRow,
      characters,
      dungeons,
      grid: gridResult.data,
      runs: runsResult.data,
    },
    now,
  );
}
