import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Missing configuration is reported, not thrown.
 *
 * Throwing here would abort module evaluation before React ever mounts, and a
 * bundled app that dies during import renders a blank white page with the real
 * reason visible only in the console. That is the single least debuggable
 * failure this app can have, and a missing environment variable is one of its
 * likeliest causes. The app checks this value and shows it on the page instead.
 */
export const configError: string | null =
  url && key
    ? null
    : 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not set. ' +
      'Locally, copy .env.example to .env.local and fill them in.';

export const supabase = createClient<Database>(
  url || 'https://unconfigured.invalid',
  key || 'unconfigured',
);
