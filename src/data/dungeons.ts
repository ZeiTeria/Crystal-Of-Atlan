import type { Tier } from '../engine/types';
import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { nextSortOrder } from './sortOrder';

export type DungeonRow = Database['public']['Tables']['dungeons']['Row'];

/** Every column a person edits. Defaults live in the screen, not here. */
export interface NewDungeon {
  name: string;
  /** Display grouping, e.g. 'HexChess'. null means the dungeon has no family. */
  group_name: string | null;
  /** Short label for the simplified matrix, e.g. 'HC'. */
  short_name: string | null;
  account_attempts: number;
  character_attempts: number;
  reset_weekday: number;
  gold_solo: number;
  gold_story: number;
  gold_elite: number;
  gold_legend: number;
  gold_solo_stone: number;
  gold_story_stone: number;
  gold_elite_stone: number;
  gold_legend_stone: number;
  manual: boolean;
  is_active: boolean;
  default_tier: Tier;
  default_min_runs: number;
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
  // Read the current slots first: the column defaults to 0, so without this a
  // new dungeon sorts above every existing one instead of appending.
  const existing = await listDungeons();
  const { data, error } = await supabase
    .from('dungeons')
    .insert({ ...input, sort_order: nextSortOrder(existing) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDungeon(id: string, patch: Omit<Partial<DungeonRow>, 'id'>): Promise<void> {
  const { error } = await supabase.from('dungeons').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * A hard delete. `character_dungeon.dungeon_id` cascades from `dungeons` (see
 * `supabase/migrations/0001_init.sql`), so deleting a dungeon silently destroys
 * every character's unlocked tier for it, with no confirmation beyond the
 * screen's own dialog — deactivate it instead, which is why `is_active` exists.
 */
export async function deleteDungeon(id: string): Promise<void> {
  const { error } = await supabase.from('dungeons').delete().eq('id', id);
  if (error) throw error;
}
