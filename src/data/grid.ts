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
 */
export async function setGridCell(
  characterId: string,
  dungeonId: string,
  patch: { tier?: Tier; min_runs?: number },
): Promise<void> {
  const { error } = await supabase
    .from('character_dungeon')
    .upsert(
      { character_id: characterId, dungeon_id: dungeonId, ...patch },
      { onConflict: 'character_id,dungeon_id' },
    );
  if (error) throw error;
}
