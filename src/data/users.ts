import { supabase } from '../lib/supabase';

export interface UserRow {
  id: string;
  discord_username: string | null;
  is_admin: boolean;
  is_approved: boolean;
}

/**
 * Every profile, for the Users screen. Returns just the caller's own row for
 * anyone who is not an admin - `profiles_select_own_or_admin` filters rather
 * than raising, so a non-admin reaching this sees a roster of one instead of an
 * error.
 */
export async function listUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, discord_username, is_admin, is_approved')
    .order('discord_username');
  if (error) throw error;
  return data ?? [];
}

/**
 * Grants or withdraws access.
 *
 * `select()` is not decoration: row level security FILTERS an update it
 * disallows, so a caller without `profiles_approve_admin` gets `error: null` and
 * a silent no-op. Counting the returned rows is the only way to tell "approved"
 * from "quietly ignored", and this screen must never report success for a write
 * the database threw away.
 */
export async function setApproval(id: string, isApproved: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_approved: isApproved })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'The database refused that change. Apply migration 0019_profile_approval.sql, ' +
        'and check this account is still an admin.',
    );
  }
}
