import type { Tier } from '../engine/types';
import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export type GridRow = Database['public']['Tables']['character_dungeon']['Row'];

export async function listGrid(characterIds: string[]): Promise<GridRow[]> {
  if (characterIds.length === 0) return [];
  const { data, error } = await supabase
    .from('character_dungeon')
    .select('*')
    .in('character_id', characterIds);
  if (error) throw error;
  return data;
}

/**
 * Upsert, not update: most pairs have no row until someone touches them, and
 * the primary key is (character_id, dungeon_id) so a conflict is the same cell.
 *
 * `cell` is the WHOLE cell, deliberately not a partial patch. An upsert that
 * omits a column inserts that column's SCHEMA default, which is not what the
 * screen was showing: an untouched pair displays the dungeon's default_tier and
 * default_min_runs, so a tier-only write would insert min_runs 0 (quietly
 * dropping a minimum of 1) and a min-runs-only write would insert tier 'none' -
 * which means "cannot enter", and makes the planner discard the pair outright.
 *
 * Requiring both fields is what makes that class of bug unrepresentable.
 */
export async function setGridCell(
  characterId: string,
  dungeonId: string,
  cell: { tier: Tier; min_runs: number },
): Promise<void> {
  const { error } = await supabase
    .from('character_dungeon')
    .upsert(
      { character_id: characterId, dungeon_id: dungeonId, ...cell },
      { onConflict: 'character_id,dungeon_id' },
    );
  if (error) throw error;
}

/**
 * Upsert many cells in one round trip. Same whole-cell contract as
 * setGridCell, for the same reason: an omitted column would insert a schema
 * default rather than what the screen was showing.
 */
export async function setGridCells(
  cells: { character_id: string; dungeon_id: string; tier: Tier; min_runs: number }[],
): Promise<void> {
  if (cells.length === 0) return;
  const { error } = await supabase
    .from('character_dungeon')
    .upsert(cells, { onConflict: 'character_id,dungeon_id' });
  if (error) throw error;
}
