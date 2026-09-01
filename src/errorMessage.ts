/**
 * Supabase throws plain objects, not `Error` instances - `err instanceof Error`
 * is `false` for them, so `String(err)` yields `[object Object]`. This
 * normalizes any thrown value into a display string: a real `Error` uses its
 * `.message`, an object carrying a `message` property uses that, and anything
 * else falls back to `String(err)`.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(err);
}
