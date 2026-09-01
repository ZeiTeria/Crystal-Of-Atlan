// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryScreen from './HistoryScreen';
import { deleteRun, listRecentRuns } from '../data/runs';
import { currentGameAccountId, listCharacters } from '../data/accounts';
import { listDungeons } from '../data/dungeons';

vi.mock('../data/runs', () => ({ listRecentRuns: vi.fn(), deleteRun: vi.fn() }));
vi.mock('../data/accounts', () => ({
  currentGameAccountId: vi.fn(),
  listCharacters: vi.fn(),
}));
vi.mock('../data/dungeons', () => ({ listDungeons: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** A promise the test controls the settlement of, to catch a mid-flight state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(currentGameAccountId).mockResolvedValue('acc');
  vi.mocked(listCharacters).mockResolvedValue([
    { id: 'c1', game_account_id: 'acc', name: 'Mage', class: null, sort_order: 0 },
  ]);
  vi.mocked(listDungeons).mockResolvedValue([
    {
      id: 'd1',
      name: 'Abyss',
      account_attempts: 18,
      character_attempts: 3,
      reset_weekday: 1,
      quest_coverage: false,
      gold_solo: 1,
      gold_story: 2,
      gold_elite: 3,
      gold_legend: 4,
      sort_order: 0,
      is_active: true,
    },
  ]);
  vi.mocked(listRecentRuns).mockResolvedValue([
    {
      id: 'r1',
      character_id: 'c1',
      dungeon_id: 'd1',
      ran_at: '2026-09-01T10:00:00Z',
      gold_earned: 30,
    },
  ]);
  vi.mocked(deleteRun).mockResolvedValue(undefined);
});

describe('HistoryScreen', () => {
  it('shows a run with its character and dungeon named', async () => {
    render(<HistoryScreen />);
    expect(await screen.findByText('Mage')).toBeDefined();
    expect(screen.getByText('Abyss')).toBeDefined();
  });

  it('undoes a run and reloads', async () => {
    render(<HistoryScreen />);
    const undo = await screen.findByRole('button', { name: /undo/i });
    fireEvent.click(undo);
    await waitFor(() => {
      expect(vi.mocked(deleteRun)).toHaveBeenCalledWith('r1');
    });
    await waitFor(() => {
      expect(vi.mocked(listRecentRuns).mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('disables Undo immediately and deletes only once when clicked twice before the delete settles', async () => {
    const gate = deferred<void>();
    vi.mocked(deleteRun).mockReturnValue(gate.promise);
    render(<HistoryScreen />);
    const undo = (await screen.findByRole('button', { name: /undo/i })) as HTMLButtonElement;

    fireEvent.click(undo);
    expect(undo.disabled).toBe(true);
    fireEvent.click(undo); // a disabled button must not fire a second deleteRun

    gate.resolve();
    await waitFor(() => {
      expect(vi.mocked(deleteRun)).toHaveBeenCalledTimes(1);
    });
  });

  it('says so when nothing has been logged', async () => {
    vi.mocked(listRecentRuns).mockResolvedValue([]);
    render(<HistoryScreen />);
    expect(await screen.findByText(/no runs logged/i)).toBeDefined();
  });
});
