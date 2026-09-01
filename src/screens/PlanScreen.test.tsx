// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanScreen from './PlanScreen';
import { loadPlanInput } from '../data/loadPlanInput';
import { logRun } from '../data/runs';
import { currentGameAccountId } from '../data/accounts';
import type { PlanInput } from '../engine/types';

vi.mock('../data/loadPlanInput', () => ({ loadPlanInput: vi.fn() }));
vi.mock('../data/runs', () => ({ logRun: vi.fn() }));
vi.mock('../data/accounts', () => ({ currentGameAccountId: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const dungeon = {
  id: 'd1',
  name: 'Abyss',
  accountAttempts: 18,
  characterAttempts: 3,
  resetWeekday: 1,
  questCoverage: false,
  gold: { solo: 10, story: 20, elite: 30, legend: 40 },
};

function anInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    characters: [{ id: 'c1', name: 'Mage' }],
    dungeons: [dungeon],
    grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }],
    accountAttemptsLeft: { d1: 18 },
    characterAttemptsLeft: { c1: { d1: 3 } },
    goldHeadroom: { c1: 1_000_000 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(currentGameAccountId).mockResolvedValue('acc');
  vi.mocked(loadPlanInput).mockResolvedValue(anInput());
  vi.mocked(logRun).mockResolvedValue(undefined);
});

describe('PlanScreen', () => {
  it('shows a row per assignment with its gold', async () => {
    render(<PlanScreen />);
    expect(await screen.findByText('Mage')).toBeDefined();
    expect(screen.getByText('Abyss')).toBeDefined();
  });

  it('logs a run with the gold that run was worth, then re-solves', async () => {
    render(<PlanScreen />);
    const done = await screen.findByRole('button', { name: /mark one run of abyss by mage/i });
    fireEvent.click(done);
    await waitFor(() => {
      expect(vi.mocked(logRun)).toHaveBeenCalledWith('c1', 'd1', 30);
    });
    // A re-solve means the input is fetched a second time.
    await waitFor(() => {
      expect(vi.mocked(loadPlanInput).mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('says there is nothing to decide when nothing is contended', async () => {
    render(<PlanScreen />);
    expect(await screen.findByText(/no choices to make/i)).toBeDefined();
  });

  it('reports an impossible minimum instead of a plan', async () => {
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({
        grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'none', minRuns: 2 }],
      }),
    );
    render(<PlanScreen />);
    expect(await screen.findByText(/has not unlocked it/i)).toBeDefined();
  });

  it('says what to do when there is nothing to plan', async () => {
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ characters: [], grid: [], characterAttemptsLeft: {}, goldHeadroom: {} }),
    );
    render(<PlanScreen />);
    expect(await screen.findByText(/add a character/i)).toBeDefined();
  });
});
