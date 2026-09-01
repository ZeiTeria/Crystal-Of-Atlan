import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export type CharacterRow = Database['public']['Tables']['characters']['Row'];

/**
 * The account this app works with. The schema allows several per user, but the
 * UI deliberately uses one; the first one, created on demand.
 *
 * Row level security scopes the select to the signed-in user, so "the first
 * row" cannot be somebody else's.
 */
export async function currentGameAccountId(): Promise<string> {
  const existing = await supabase
    .from('game_accounts')
    .select('id')
    .order('created_at')
    .limit(1);
  if (existing.error) throw existing.error;
  const first = existing.data[0];
  if (first) return first.id;

  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error('not signed in');

  const created = await supabase
    .from('game_accounts')
    .insert({ owner_id: ownerId, name: 'Main' })
    .select('id')
    .single();
  if (created.error) throw created.error;
  return created.data.id;
}

export async function listCharacters(gameAccountId: string): Promise<CharacterRow[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('game_account_id', gameAccountId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createCharacter(
  gameAccountId: string,
  name: string,
): Promise<CharacterRow> {
  const { data, error } = await supabase
    .from('characters')
    .insert({ game_account_id: gameAccountId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameCharacter(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('characters').update({ name }).eq('id', id);
  if (error) throw error;
}

/** Grid rows and logged runs cascade from the character. */
export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase.from('characters').delete().eq('id', id);
  if (error) throw error;
}
