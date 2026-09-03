import type { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export type AppSettingsRow = Database['public']['Tables']['app_settings']['Row'];

/** The single settings row. Readable by anyone signed in; writable by admins. */
export async function loadAppSettings(): Promise<AppSettingsRow> {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', true).single();
  if (error) throw error;
  return data;
}

/**
 * How many characters an account may have, before the setting is read.
 *
 * Used when `app_settings.max_characters` is absent, which is the case until
 * migration 0010 has run against a project. Falling back to today's answer
 * beats falling back to "no limit", which would let the roster past a cap the
 * game itself enforces.
 */
export const DEFAULT_MAX_CHARACTERS = 12;

export function maxCharacters(settings: { max_characters?: number } | null | undefined): number {
  return settings?.max_characters ?? DEFAULT_MAX_CHARACTERS;
}

/** Admin-only by RLS, not by this function - the policy is the check. */
export async function setMaxCharacters(value: number): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({ max_characters: value })
    .eq('id', true);
  if (error) throw error;
}

export async function setStoneRate(value: number): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({ stone_rate: value })
    .eq('id', true);
  if (error) throw error;
}

/**
 * The name a character gets when its owner does not type one.
 *
 * The lowest unused number rather than "one more than the count": delete Char2
 * out of three and the count would hand the next character the name Char3,
 * which is already taken. Existing names are compared case-insensitively for
 * the same reason - "char2" and "Char2" are the same name to a person reading
 * the roster.
 */
export function nextDefaultName(existing: { name: string }[]): string {
  const taken = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  for (let n = 1; ; n++) {
    const candidate = `Char${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
