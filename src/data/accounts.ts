import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { nextSortOrder } from './sortOrder';

export type CharacterRow = Database['public']['Tables']['characters']['Row'];

/**
 * The oldest game account row for the signed-in user, or null if none exists
 * yet. Row level security scopes the select to that user, so "the oldest row"
 * cannot be somebody else's.
 */
async function oldestGameAccountId(): Promise<string | null> {
  const existing = await supabase
    .from('game_accounts')
    .select('id')
    .order('created_at')
    .limit(1);
  if (existing.error) throw existing.error;
  return existing.data[0]?.id ?? null;
}

/**
 * The account this app works with. The schema allows several per user, but the
 * UI deliberately uses one; the first one, created on demand.
 */
export async function currentGameAccountId(): Promise<string> {
  const first = await oldestGameAccountId();
  if (first) return first;

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

  const newId = created.data.id;
  // Slots 10 apart, matching nextSortOrder and the reorder's (i + 1) * 10, so
  // seeded and later-added characters share one spacing scheme.
  await supabase.from('characters').insert(
    [1, 2, 3, 4, 5, 6].map((n) => ({
      game_account_id: newId,
      name: `Character ${n}`,
      sort_order: n * 10,
    })),
  );

  /*
   * Re-read the oldest row instead of returning `newId` here. This
   * function reads-then-creates, and two callers can both pass the empty
   * select above before either insert lands: React `<StrictMode>`
   * double-invokes the mount effect in dev, and two browser tabs do it in
   * production. There is deliberately no unique constraint on `owner_id` (see
   * the design spec — multiple game accounts per user is a kept-open future
   * feature), so both inserts succeed and two rows exist.
   *
   * If each caller trusted its own insert's id, they would settle on
   * *different* accounts: the caller whose insert landed second would add
   * characters to the newer row, while every subsequent page load (via this
   * same oldest-row select) resolves the older one first — so those
   * characters would appear to have vanished. Re-reading after inserting
   * makes every caller converge on the same account no matter who won the
   * race; the loser's row becomes an inert duplicate instead of somewhere
   * data can strand. Do not remove this re-read as "redundant" with the
   * insert above — it is the fix.
   */
  const settled = await oldestGameAccountId();
  if (!settled) throw new Error('game account insert did not persist');
  return settled;
}

export async function listCharacters(gameAccountId: string): Promise<CharacterRow[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('game_account_id', gameAccountId)
    // sort_order only. A name tiebreak here is what made characters come out
    // alphabetical whenever their slots collided which - before nextSortOrder -
    // was always, since the column defaults to 0 and nothing set it.
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function createCharacter(
  gameAccountId: string,
  name: string,
): Promise<CharacterRow> {
  const existing = await listCharacters(gameAccountId);
  const { data, error } = await supabase
    .from('characters')
    .insert({ game_account_id: gameAccountId, name, sort_order: nextSortOrder(existing) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameCharacter(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('characters').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function toggleCharacterActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from('characters').update({ is_active }).eq('id', id);
  if (error) throw error;
}

/** Grid rows and logged runs cascade from the character. */
export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase.from('characters').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Rewrites every character's sort_order after a reorder. Not transactional -
 * the JS client has no multi-row update without an RPC - so an interruption can
 * leave the list half-renumbered, which is recoverable by reordering again.
 */
export async function setCharacterOrder(
  patches: { id: string; sort_order: number }[],
): Promise<void> {
  await Promise.all(
    patches.map(async (p) => {
      const { error } = await supabase
        .from('characters')
        .update({ sort_order: p.sort_order })
        .eq('id', p.id);
      if (error) throw error;
    }),
  );
}
