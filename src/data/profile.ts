import { supabase } from '../lib/supabase';

export interface Profile {
  discord_username: string | null;
  is_admin: boolean;
}

/**
 * The signed-in user's own profile row. Row level security limits `profiles` to
 * one row per user, so `single()` is exact rather than optimistic.
 */
export async function loadProfile(): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('discord_username, is_admin')
    .single();
  if (error) throw error;
  return data;
}
