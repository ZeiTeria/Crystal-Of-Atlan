import { supabase } from '../lib/supabase';

export interface Profile {
  discord_username: string | null;
  is_admin: boolean;
  is_approved: boolean;
}

/**
 * The signed-in user's own profile row.
 *
 * Filtered by id explicitly, NOT left to row level security. It used to rely on
 * `profiles_select_own` returning exactly one row, which was true right up until
 * 0019 let admins read the whole table to run the Users screen. From that moment
 * an unfiltered `single()` sees every profile for an admin, fails with PGRST116,
 * and App treats the throw as "no profile" - locking the admin out of their own
 * site with no way back except the SQL editor. `eq` makes the row count a
 * property of the query rather than of whatever policy happens to be installed.
 */
export async function loadProfile(): Promise<Profile> {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const id = user.user?.id;
  if (!id) throw new Error('not signed in');

  const { data, error } = await supabase
    .from('profiles')
    .select('discord_username, is_admin, is_approved')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
