// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanScreen from './PlanScreen';
import { loadPlanInput } from '../data/loadPlanInput';
import { logRun } from '../data/runs';
import { currentGameAccountId } from '../data/accounts';
import type { PlanInput } from '../engine/types';
import { stubMatchMedia } from '../ui/testing/matchMedia';
import { resetDensity } from '../ui/density';

vi.mock('../data/loadPlanInput', () => ({ loadPlanInput: vi.fn() }));
vi.mock('../data/runs', () => ({ logRun: vi.fn(), logRuns: vi.fn() }));
vi.mock('../data/accounts', () => ({ currentGameAccountId: vi.fn() }));

afterEach(() => {
  resetDensity();
  vi.unstubAllGlobals();
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
  default_tier: 'elite' as const,
  default_min_runs: 1,
  sort_order: 10,
  group_name: null,
  short_name: null,
  goldEstimated: [],
  goldUnknown: false,
};

function anInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    characters: [{ id: 'c1', name: 'Mage' }],
    dungeons: [dungeon],
    grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }],
    accountAttemptsLeft: { d1: 18 },
    characterAttemptsLeft: { c1: { d1: 3 } },
    goldHeadroom: { c1: 1_000_000 },
    settings: {
      goldCap: 1_000_000,
      goldResetWeekday: 1,
      resetHour: 6,
      timeZone: 'UTC',
    },
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
    expect(await screen.findAllByText('Mage')).toBeDefined();
    // Simplified is the default, so the column reads as its short label; the
    // full name stays on the title.
    expect(screen.getByRole('columnheader', { name: 'A' }).getAttribute('title')).toBe('Abyss');
  });

  it('counts down to the coming reset, not the one after it', async () => {
    // An hour before the Monday 06:00 Asia/Singapore reset - the window where
    // deriving the boundary by looking a week-and-a-bit ahead read 7 days late.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-06T21:00:00Z'));
    try {
      vi.mocked(loadPlanInput).mockResolvedValue(
        anInput({
          settings: {
            goldCap: 1_000_000,
            goldResetWeekday: 1,
            resetHour: 6,
            timeZone: 'Asia/Singapore',
          },
        }),
      );
      render(<PlanScreen />);
      // The parts are separate text nodes, so match on the element's own text.
      // Under the old derivation this same instant read "7d ...".
      await vi.waitFor(() =>
        expect(
          screen.getAllByText((_, el) => /^0d 0h 59m \d\ds$/.test(el?.textContent ?? '')),
        ).not.toHaveLength(0),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs a run with the gold that run was worth, then re-solves', async () => {
    render(<PlanScreen />);
    const done = await screen.findByRole('button', { name: /log one run of abyss by mage/i });
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
    await screen.findAllByText('Mage');
    expect(await screen.findByText(/at most 50/)).toBeDefined();
    expect(screen.getByText(/50 by the gold cap, 90 by attempts/)).toBeDefined();

    expect(screen.getByText(/why it stops there/i)).toBeDefined();
    expect(screen.getByText(/cannot be used/i)).toBeDefined();
  });

  it('reports the tighter of the two ceilings when the attempt ceiling is the binding one', async () => {
    // goldHeadroom is deliberately generous (1,000,000) so it cannot be the
    // binding term; accountAttemptsLeft (1) makes the attempt ceiling
    // 1 * 30 = 30. Math.min(a, b) and plain `a` (goldCeiling) would both
    // render 1,000,000 here, so only the attempts term being present is what
    // makes this case fail on Math.max, `+`, or a dropped attempts term.
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ goldHeadroom: { c1: 1_000_000 }, accountAttemptsLeft: { d1: 1 } }),
    );
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(await screen.findByText(/at most 30/)).toBeDefined();
    expect(screen.getByText(/1,000,000 by the gold cap, 30 by attempts/)).toBeDefined();
  });

  it('disables Done immediately and logs only once when clicked twice before the insert settles', async () => {
    const gate = deferred<void>();
    vi.mocked(logRun).mockReturnValue(gate.promise);
    render(<PlanScreen />);
    const done = (await screen.findByRole('button', {
      name: /log one run of abyss by mage/i,
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
    // Supabase errors are plain objects, not Error instances - this fixture
    // pins the shape production actually throws, not `NamedError`'s.
    vi.mocked(logRun).mockRejectedValueOnce({
      message: 'insert violates row-level security',
      code: '42501',
    });
    render(<PlanScreen />);
    const done = await screen.findByRole('button', { name: /log one run of abyss by mage/i });
    fireEvent.click(done);

    expect(await screen.findByText(/insert violates row-level security/i)).toBeDefined();
    expect(vi.mocked(loadPlanInput).mock.calls.length).toBe(1);
  });

  it('drops the plan and stops it being actionable when the re-solve after a logged run fails, but offers a retry', async () => {
    render(<PlanScreen />);
    const done = await screen.findByRole('button', { name: /log one run of abyss by mage/i });
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
    expect(await screen.findAllByText('Mage')).toBeDefined();
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
    expect(await screen.findAllByText('Mage')).toBeDefined();
  });

  it('clears the stale error and shows progress while a retry is in flight', async () => {
    vi.mocked(loadPlanInput).mockRejectedValueOnce(
      new NamedError('FetchError', 'could not reach supabase'),
    );
    render(<PlanScreen />);
    expect(await screen.findByText(/could not reach supabase/i)).toBeDefined();

    const gate = deferred<PlanInput>();
    vi.mocked(loadPlanInput).mockReturnValue(gate.promise);
    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    // While the retry is in flight, the old failure must not still be on
    // screen looking unchanged — progress should be visible instead.
    await waitFor(() => {
      expect(screen.queryByText(/could not reach supabase/i)).toBeNull();
    });
    expect(screen.getByText(/solving/i)).toBeDefined();

    gate.resolve(anInput());
    expect(await screen.findAllByText('Mage')).toBeDefined();
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

describe('PlanScreen on a phone', () => {
  it('lists only the assignments of the shown character, with a Log button', async () => {
    stubMatchMedia(true);
    render(<PlanScreen />);
    const log = await screen.findByRole('button', { name: /log one run of abyss by mage/i });
    fireEvent.click(log);
    await waitFor(() => {
      expect(vi.mocked(logRun)).toHaveBeenCalledWith('c1', 'd1', 30);
    });
  });

  it('offers the character picker rather than a matrix', async () => {
    stubMatchMedia(true);
    render(<PlanScreen />);
    expect(await screen.findByRole('tab', { name: 'Mage' })).toBeDefined();
  });
});

describe('PlanScreen gold that is standing in', () => {
  it('marks only the cell whose own difficulty has no figure', async () => {
    // The character runs this dungeon at elite, and elite HAS a figure. A
    // dungeon-level mark would flag this cell anyway, which trains the eye to
    // ignore the mark entirely.
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ dungeons: [{ ...dungeon, goldEstimated: ['solo', 'legend'] }] }),
    );
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(screen.queryAllByRole('button', { name: /has no gold figure/i })).toHaveLength(0);
  });

  it('marks the cell when the difficulty it actually runs has no figure', async () => {
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ dungeons: [{ ...dungeon, goldEstimated: ['elite'] }] }),
    );
    render(<PlanScreen />);
    const dot = await screen.findByRole('button', { name: /has no gold figure for elite/i });
    // The catalogue is admin-only, so a player is pointed at whoever can edit it
    // rather than at a screen they cannot open.
    expect(dot.getAttribute('aria-label')).toMatch(/@zteria/i);
    // No native tooltip: it would say the same thing twice, in two places.
    expect(dot.getAttribute('title')).toBe(null);
  });

  it('marks a dungeon with no figures at all, whatever the difficulty', async () => {
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
    );
    render(<PlanScreen />);
    expect(await screen.findByRole('button', { name: /no gold figures at all/i })).toBeDefined();
  });

  it('opens an explanation on click, and closes it on Escape', async () => {
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
    );
    render(<PlanScreen />);
    const dot = await screen.findByRole('button', { name: /no gold figures at all/i });

    fireEvent.click(dot);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('dialog').textContent).toMatch(/@zteria/i);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
  });

  it('marks nothing when every difficulty has a real figure', async () => {
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /gold/i })).toHaveLength(0);
  });
});

describe('PlanScreen explanation on hover', () => {
  it('opens on pointing at it, and closes again on leaving', async () => {
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
    );
    render(<PlanScreen />);
    const dot = await screen.findByRole('button', { name: /no gold figures at all/i });
    const wrap = dot.parentElement as HTMLElement;

    fireEvent.mouseEnter(wrap);
    expect(screen.getByRole('dialog')).toBeDefined();

    fireEvent.mouseLeave(wrap);
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('stays open after a click, so it survives the pointer leaving', async () => {
    // Which is what makes it usable on a touch screen, where there is no hover
    // to keep it open in the first place.
    vi.mocked(loadPlanInput).mockResolvedValue(
      anInput({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
    );
    render(<PlanScreen />);
    const dot = await screen.findByRole('button', { name: /no gold figures at all/i });
    const wrap = dot.parentElement as HTMLElement;

    fireEvent.mouseEnter(wrap);
    fireEvent.click(dot);
    fireEvent.mouseLeave(wrap);

    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
