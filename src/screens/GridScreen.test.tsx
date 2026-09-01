// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GridScreen from './GridScreen';
import { listGrid, setGridCell } from '../data/grid';
import { listDungeons } from '../data/dungeons';
import { currentGameAccountId, listCharacters } from '../data/accounts';

vi.mock('../data/grid', () => ({ listGrid: vi.fn(), setGridCell: vi.fn() }));
vi.mock('../data/dungeons', () => ({ listDungeons: vi.fn() }));
vi.mock('../data/accounts', () => ({
  currentGameAccountId: vi.fn(),
  listCharacters: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const dungeon = {
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
};

const character = { id: 'c1', game_account_id: 'acc', name: 'Mage', class: null, sort_order: 0 };

beforeEach(() => {
  vi.mocked(currentGameAccountId).mockResolvedValue('acc');
  vi.mocked(listCharacters).mockResolvedValue([character]);
  vi.mocked(listDungeons).mockResolvedValue([dungeon]);
  vi.mocked(listGrid).mockResolvedValue([
    { character_id: 'c1', dungeon_id: 'd1', tier: 'elite', min_runs: 2 },
  ]);
  vi.mocked(setGridCell).mockResolvedValue(undefined);
});

describe('GridScreen', () => {
  it('shows the stored tier and minimum for a pair', async () => {
    render(<GridScreen />);
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.value).toBe('elite');
    const min = screen.getByLabelText('Mage minimum runs in Abyss') as HTMLInputElement;
    expect(min.value).toBe('2');
  });

  it('defaults a pair with no row to locked', async () => {
    vi.mocked(listGrid).mockResolvedValue([]);
    render(<GridScreen />);
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.value).toBe('none');
  });

  it('upserts a tier change immediately', async () => {
    render(<GridScreen />);
    const tier = await screen.findByLabelText('Mage tier in Abyss');
    fireEvent.change(tier, { target: { value: 'legend' } });
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', { tier: 'legend' });
    });
  });

  it('writes a minimum on blur, as a number', async () => {
    render(<GridScreen />);
    const min = await screen.findByLabelText('Mage minimum runs in Abyss');
    fireEvent.change(min, { target: { value: '3' } });
    fireEvent.blur(min);
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', { min_runs: 3 });
    });
  });

  it('says what to do when there is nothing to fill in', async () => {
    vi.mocked(listCharacters).mockResolvedValue([]);
    render(<GridScreen />);
    expect(await screen.findByText(/add a character/i)).toBeDefined();
  });
});
