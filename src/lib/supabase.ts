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

/** PostgREST's code for "this token's `iat` is later than my clock". */
const JWT_ISSUED_AT_FUTURE = 'PGRST303';

/**
 * How long to wait before the retry. It only has to outlast the skew between
 * the two Supabase services, which is a second or two in practice.
 */
const RETRY_DELAY_MS = 1100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wraps `fetch` so a request rejected as PGRST303 is sent a second time.
 *
 * Supabase Auth stamps the access token's `iat` from its own clock, and
 * PostgREST validates it against a different one. When those two drift apart,
 * a token that was just issued looks to PostgREST like it was minted in the
 * future, and the very first query after sign-in comes back 401 — even though
 * nothing is wrong with the token and it starts working seconds later on its
 * own. Neither clock is ours to fix, so the only thing this app can do is wait
 * out the skew.
 *
 * This sits on the client's `fetch` rather than at the call sites because the
 * failure can hit *any* query; putting it here means no caller has to know the
 * error exists.
 *
 * `baseFetch` and `delay` are parameters so the behaviour can be tested without
 * a network or a real 1.1-second wait.
 */
export function retryingFetch(
  baseFetch: typeof fetch = globalThis.fetch.bind(globalThis),
  delay: (ms: number) => Promise<unknown> = sleep,
): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);

    // Cloning leaves the caller's copy of the body unread. Without it, peeking
    // at the error code here would consume the stream the caller still needs
    // in every case where we decide not to retry.
    if (!response.ok && response.status === 401) {
      let code: unknown;
      try {
        code = (await response.clone().json())?.code;
      } catch {
        // A 401 whose body is not JSON is somebody else's error, not this one.
        return response;
      }
      if (code === JWT_ISSUED_AT_FUTURE) {
        await delay(RETRY_DELAY_MS);
        // Once only, and whatever comes back is the answer. A second failure
        // means the skew is wider than the wait, which is a Supabase-side
        // problem that retrying harder will not solve.
        return baseFetch(input, init);
      }
    }

    return response;
  };
}

export const supabase = createClient<Database>(
  url || 'https://unconfigured.invalid',
  key || 'unconfigured',
  { global: { fetch: retryingFetch() } },
);
