import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export type RunRow = Database['public']['Tables']['runs']['Row'];

/**
 * `gold_earned` is stored, not looked up later: editing a catalogue value must
 * never rewrite what a past run was actually worth.
 */
export async function logRun(
  characterId: string,
  dungeonId: string,
  goldEarned: number,
): Promise<void> {
  const { error } = await supabase
    .from('runs')
    .insert({ character_id: characterId, dungeon_id: dungeonId, gold_earned: goldEarned });
  if (error) throw error;
}

export async function logRuns(
  runs: { character_id: string; dungeon_id: string; gold_earned: number }[]
): Promise<void> {
  if (runs.length === 0) return;
  const { error } = await supabase.from('runs').insert(runs);
  if (error) throw error;
}

export async function listRecentRuns(characterIds: string[], limit = 50): Promise<RunRow[]> {
  if (characterIds.length === 0) return [];
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .in('character_id', characterIds)
    .order('ran_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function listAllRuns(characterIds: string[]): Promise<RunRow[]> {
  if (characterIds.length === 0) return [];
  // For historical stats, fetch everything for these characters
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .in('character_id', characterIds)
    .order('ran_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteRun(id: string): Promise<void> {
  const { error } = await supabase.from('runs').delete().eq('id', id);
  if (error) throw error;
}
