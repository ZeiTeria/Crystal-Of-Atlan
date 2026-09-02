import { describe, expect, it, vi } from 'vitest';
import { retryingFetch } from './supabase';

/**
 * The retry exists for a failure that cannot be reproduced on demand — it needs
 * two Supabase services whose clocks disagree — so the wrapper is tested
 * against a fake `fetch` that simply says what PostgREST would have said.
 */

/** A `delay` that resolves at once, so the tests never wait the real 1.1s. */
const noDelay = vi.fn(async () => {});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('retryingFetch', () => {
  it('passes a successful response straight through', async () => {
    const base = vi.fn(async () => new Response('ok', { status: 200 }));
    const res = await retryingFetch(base, noDelay)('https://example.test');

    expect(base).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('does not retry a 401 that is some other error', async () => {
    const base = vi.fn(async () => jsonResponse({ code: 'PGRST301' }, 401));
    const res = await retryingFetch(base, noDelay)('https://example.test');

    expect(base).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
  });

  it('retries exactly once on PGRST303 and returns the second response', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'PGRST303' }, 401))
      .mockResolvedValueOnce(new Response('second time lucky', { status: 200 }));
    const delay = vi.fn(async () => {});

    const res = await retryingFetch(base, delay)('https://example.test');

    expect(base).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('second time lucky');
  });

  it('returns the second response even when the retry also fails', async () => {
    const base = vi.fn(async () => jsonResponse({ code: 'PGRST303' }, 401));
    const res = await retryingFetch(base, noDelay)('https://example.test');

    expect(base).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(401);
  });

  it('does not throw when a 401 body is not JSON', async () => {
    const base = vi.fn(async () => new Response('<html>gateway</html>', { status: 401 }));
    const res = await retryingFetch(base, noDelay)('https://example.test');

    expect(base).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe('<html>gateway</html>');
  });

  // The whole point of cloning: peeking at the error code must not consume the
  // body the caller is about to read. supabase-js reads it to build its error.
  it('leaves the returned body readable by the caller', async () => {
    const base = vi.fn(async () => jsonResponse({ code: 'PGRST301', message: 'JWT expired' }, 401));
    const res = await retryingFetch(base, noDelay)('https://example.test');

    expect(res.bodyUsed).toBe(false);
    expect(await res.json()).toEqual({ code: 'PGRST301', message: 'JWT expired' });
  });

  it('forwards the method, headers and body to the retry unchanged', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'PGRST303' }, 401))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const init = { method: 'POST', headers: { apikey: 'k' }, body: '{"name":"Vex"}' };

    await retryingFetch(base, noDelay)('https://example.test/rest/v1/characters', init);

    expect(base).toHaveBeenNthCalledWith(2, 'https://example.test/rest/v1/characters', init);
  });
});
