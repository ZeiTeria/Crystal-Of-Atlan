import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

/**
 * Where Discord sends the browser back to. Must exactly match a URL listed in
 * Supabase's Redirect URLs. `BASE_URL` carries the GitHub Pages subpath, so
 * this is correct in dev (`/`) and in production (`/Crystal-Of-Atlan/`) without
 * a branch.
 */
export function redirectTarget(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

export async function signInWithDiscord(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: redirectTarget() },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
