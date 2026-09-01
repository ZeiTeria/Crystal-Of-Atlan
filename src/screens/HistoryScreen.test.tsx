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

  it('says so when nothing has been logged', async () => {
    vi.mocked(listRecentRuns).mockResolvedValue([]);
    render(<HistoryScreen />);
    expect(await screen.findByText(/no runs logged/i)).toBeDefined();
  });
});
