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

/** An Error whose `.name` differs from `.message`, so a test can tell whether
 * the screen rendered `err.message` (clean) or `String(err)` (name-prefixed). */
class NamedError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

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

  it('reports the tighter of the two ceilings, not their sum or the wrong one, and renders a stopping reason', async () => {
    // goldHeadroom (50) is deliberately tighter than what the attempts could
    // earn (min(characterAttempts, accountAttempts) * goldPerRun = 3 * 30 = 90).
    // Math.max, +, or dropping either term would all print something other than 50.
    vi.mocked(loadPlanInput).mockResolvedValue(anInput({ goldHeadroom: { c1: 50 } }));
    render(<PlanScreen />);
    await screen.findByText('Mage');
    expect(await screen.findByText(/at most 50/)).toBeDefined();
    expect(screen.getByText(/50 by the gold cap, 90 by attempts/)).toBeDefined();

    expect(screen.getByText(/why it stops there/i)).toBeDefined();
    expect(screen.getByText(/cannot be used/i)).toBeDefined();
  });

  it('disables Done immediately and logs only once when clicked twice before the insert settles', async () => {
    const gate = deferred<void>();
    vi.mocked(logRun).mockReturnValue(gate.promise);
    render(<PlanScreen />);
    const done = (await screen.findByRole('button', {
      name: /mark one run of abyss by mage/i,
    })) as HTMLButtonElement;

    fireEvent.click(done);
    expect(done.disabled).toBe(true);
    fireEvent.click(done); // a disabled button must not fire a second logRun

    gate.resolve();
    await waitFor(() => {
      expect(vi.mocked(logRun)).toHaveBeenCalledTimes(1);
    });
  });

  it('does not re-solve when logging a run fails, and shows the failure', async () => {
    vi.mocked(logRun).mockRejectedValueOnce(
      new NamedError('PostgrestError', 'insert violates row-level security'),
    );
    render(<PlanScreen />);
    const done = await screen.findByRole('button', { name: /mark one run of abyss by mage/i });
    fireEvent.click(done);

    expect(await screen.findByText(/insert violates row-level security/i)).toBeDefined();
    expect(vi.mocked(loadPlanInput).mock.calls.length).toBe(1);
  });

  it('drops the plan and stops it being actionable when the re-solve after a logged run fails, but offers a retry', async () => {
    render(<PlanScreen />);
    const done = await screen.findByRole('button', { name: /mark one run of abyss by mage/i });
    vi.mocked(loadPlanInput).mockRejectedValueOnce(
      new NamedError('FetchError', 'the network dropped'),
    );

    fireEvent.click(done);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /mark one run/i })).toBeNull();
    });
    expect(screen.getByText(/the network dropped/i)).toBeDefined();

    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);
    expect(await screen.findByText('Mage')).toBeDefined();
  });

  it('does not render a table when the initial load fails, and offers a retry', async () => {
    vi.mocked(loadPlanInput).mockRejectedValueOnce(
      new NamedError('FetchError', 'could not reach supabase'),
    );
    render(<PlanScreen />);

    expect(await screen.findByText(/could not reach supabase/i)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();

    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);
    expect(await screen.findByText('Mage')).toBeDefined();
  });

  it('shows the error message, not the raw error object', async () => {
    vi.mocked(loadPlanInput).mockRejectedValueOnce(
      new NamedError('SolverNotOptimalError', 'solver pass "attempts" returned status Infeasible'),
    );
    render(<PlanScreen />);

    expect(
      await screen.findByText('Error: solver pass "attempts" returned status Infeasible'),
    ).toBeDefined();
    expect(screen.queryByText(/SolverNotOptimalError:/)).toBeNull();
  });
});
