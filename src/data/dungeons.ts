import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export type DungeonRow = Database['public']['Tables']['dungeons']['Row'];

/** Every column a person edits. Defaults live in the screen, not here. */
export interface NewDungeon {
  name: string;
  account_attempts: number;
  character_attempts: number;
  reset_weekday: number;
  quest_coverage: boolean;
  gold_solo: number;
  gold_story: number;
  gold_elite: number;
  gold_legend: number;
  is_active: boolean;
}

export async function listDungeons(): Promise<DungeonRow[]> {
  const { data, error } = await supabase
    .from('dungeons')
    .select('*')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createDungeon(input: NewDungeon): Promise<DungeonRow> {
  const { data, error } = await supabase.from('dungeons').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateDungeon(id: string, patch: Partial<NewDungeon>): Promise<void> {
  const { error } = await supabase.from('dungeons').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * A hard delete. `runs.dungeon_id` and `character_dungeon.dungeon_id` both
 * cascade from `dungeons` (see `supabase/migrations/0001_init.sql`), so deleting
 * a dungeon silently destroys every logged run of it, for every character, with
 * no confirmation beyond the screen's own dialog — deactivate it instead, which
 * is why `is_active` exists.
 */
export async function deleteDungeon(id: string): Promise<void> {
  const { error } = await supabase.from('dungeons').delete().eq('id', id);
  if (error) throw error;
}
