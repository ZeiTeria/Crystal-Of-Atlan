import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentGameAccountId } from './accounts';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

/** A minimal stand-in for the mocked Supabase client used by these tests. */
type FakeSupabase = {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};
const fakeSupabase = supabase as unknown as FakeSupabase;

/** Chain for `.from('game_accounts').select('id').order(...).limit(1)`. */
function selectChain(rows: Array<{ id: string }>) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return chain;
}

/** Chain for `.from('game_accounts').insert(...).select('id').single()`. */
function insertChain(id: string) {
  const chain = {
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: { id }, error: null })),
  };
  return chain;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('currentGameAccountId', () => {
  it('returns the existing oldest account without inserting', async () => {
    fakeSupabase.from.mockImplementationOnce(() => selectChain([{ id: 'existing' }]));

    const id = await currentGameAccountId();

    expect(id).toBe('existing');
    expect(fakeSupabase.from).toHaveBeenCalledTimes(1);
  });

  /**
   * Reproduces the read-then-create race this fix closes: two callers can
   * both see zero rows before either insert lands, so this caller's own
   * insert succeeds but is NOT the row that should win — an earlier insert
   * (lower `created_at`) from the other caller already landed by the time
   * this one re-reads. If `currentGameAccountId` ever goes back to trusting
   * its own insert's id, this test observes 'newer-id' and fails.
   */
  it('converges on the oldest row, not this call’s own insert, after a create race', async () => {
    fakeSupabase.from
      .mockImplementationOnce(() => selectChain([])) // nobody has an account yet
      .mockImplementationOnce(() => insertChain('newer-id')) // this caller's own insert
      .mockImplementationOnce(() => selectChain([{ id: 'older-id' }])); // re-read: the other caller's insert landed first
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const id = await currentGameAccountId();

    expect(id).toBe('older-id');
    expect(fakeSupabase.from).toHaveBeenCalledTimes(3);
  });

  it('throws when no user is signed in and no account exists', async () => {
    fakeSupabase.from.mockImplementationOnce(() => selectChain([]));
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(currentGameAccountId()).rejects.toThrow('not signed in');
  });
});
