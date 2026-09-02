// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuestLog from './QuestLog';
import { setGridCell } from '../data/grid';
import {
  deleteCharacter,
  renameCharacter,
  setCharacterOrder,
  toggleCharacterActive,
  type CharacterRow,
} from '../data/accounts';
import type { PlanAssignment, PlanInput } from '../engine/types';
import { stubMatchMedia } from '../ui/testing/matchMedia';

vi.mock('../data/grid', () => ({ setGridCell: vi.fn() }));
vi.mock('../data/accounts', () => ({
  renameCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  toggleCharacterActive: vi.fn(),
  setCharacterOrder: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const dungeon = {
  id: 'd1',
  name: 'Abyss',
  accountAttempts: 18,
  characterAttempts: 3,
  resetWeekday: 1,
  questCoverage: false,
  gold: { solo: 1, story: 2, elite: 3, legend: 4 },
  default_tier: 'elite' as const,
  default_min_runs: 1,
  sort_order: 10,
  group_name: null,
  short_name: null,
  goldEstimated: [],
  goldUnknown: false,
};

const mage: CharacterRow = {
  id: 'c1',
  game_account_id: 'acc',
  name: 'Mage',
  class: null,
  sort_order: 10,
  is_active: true,
};
const rogue: CharacterRow = { ...mage, id: 'c2', name: 'Rogue', sort_order: 20 };

function anInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    characters: [{ id: 'c1', name: 'Mage', class: null }],
    dungeons: [dungeon],
    grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 2 }],
    accountAttemptsLeft: { d1: 18 },
    characterAttemptsLeft: { c1: { d1: 3 } },
    goldHeadroom: { c1: 1_000_000 },
    settings: { goldCap: 1_000_000, goldResetWeekday: 1, resetHour: 6, timeZone: 'UTC' },
    ...overrides,
  };
}

/** The screen above owns the write-then-refresh; here it is just the write. */
const mutate = vi.fn(async (write: () => Promise<void>) => {
  await write();
});

function renderLog(
  opts: {
    input?: PlanInput;
    assignments?: PlanAssignment[];
    roster?: CharacterRow[];
  } = {},
) {
  return render(
    <QuestLog
      input={opts.input ?? anInput()}
      assignments={opts.assignments ?? []}
      roster={opts.roster ?? [mage]}
      mutate={mutate}
      busy={false}
    />,
  );
}

beforeEach(() => {
  vi.mocked(setGridCell).mockResolvedValue(undefined);
  vi.mocked(renameCharacter).mockResolvedValue(undefined);
  vi.mocked(deleteCharacter).mockResolvedValue(undefined);
  vi.mocked(toggleCharacterActive).mockResolvedValue(undefined);
  vi.mocked(setCharacterOrder).mockResolvedValue(undefined);
  mutate.mockClear();
});

describe('QuestLog cells', () => {
  it('shows the stored tier and minimum for a pair', async () => {
    renderLog();
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.value).toBe('elite');
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('2');
  });

  it('defaults a pair with no row to the dungeon default tier and minimum', async () => {
    renderLog({ input: anInput({ grid: [] }) });
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.value).toBe('elite');
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('1');
  });

  it('upserts a tier change immediately', async () => {
    renderLog();
    fireEvent.change(await screen.findByLabelText('Mage tier in Abyss'), {
      target: { value: 'legend' },
    });
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 2,
      });
    });
  });

  it('writes the whole cell when a tier changes, so the minimum is not reset', async () => {
    // A pair with no row yet shows the dungeon's defaults. Sending only the
    // tier makes the upsert insert a row whose min_runs takes the SCHEMA
    // default of 0, so the displayed minimum of 1 silently becomes 0.
    renderLog({ input: anInput({ grid: [] }) });
    fireEvent.change(await screen.findByLabelText('Mage tier in Abyss'), {
      target: { value: 'legend' },
    });
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 1,
      });
    });
  });

  it('writes the whole cell when a minimum changes, so the tier is not locked to none', async () => {
    // The same hole in the other direction, and worse: an inserted row would
    // take tier 'none', which means "cannot enter" - the planner drops the pair
    // entirely rather than merely planning it badly.
    renderLog({ input: anInput({ grid: [] }) });
    fireEvent.click(
      await screen.findByRole('button', { name: /one more minimum run of abyss for mage/i }),
    );
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 2,
      });
    });
  });

  it('steps the minimum one at a time, so there is no half-typed number to save', async () => {
    // The old free-text field wrote on blur precisely because writing per
    // keystroke saved the "1" of a "10" and took the focus with the refresh.
    // A stepper has no intermediate state to get that wrong.
    renderLog();
    fireEvent.click(screen.getByRole('button', { name: /one fewer minimum run of abyss for mage/i }));
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledExactlyOnceWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 1,
      });
    });
  });

  it('cannot step past the per-character cap, or below zero', async () => {
    renderLog({
      input: anInput({ grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 3 }] }),
    });
    const up = (await screen.findByRole('button', {
      name: /one more minimum run of abyss for mage/i,
    })) as HTMLButtonElement;
    expect(up.disabled).toBe(true);

    cleanup();
    renderLog({
      input: anInput({ grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0 }] }),
    });
    const down = (await screen.findByRole('button', {
      name: /one fewer minimum run of abyss for mage/i,
    })) as HTMLButtonElement;
    expect(down.disabled).toBe(true);
  });

  it('prices a run at the tier the character actually runs, not a fixed one', async () => {
    // gold.elite is 3 and gold.story is 2: reading the wrong one is invisible
    // until the two differ.
    renderLog({
      input: anInput({ grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'story', minRuns: 0 }] }),
    });
    expect(await screen.findByText(/2 per run/)).toBeDefined();
  });

  it('says a dungeon is not unlocked rather than pricing it', async () => {
    renderLog({
      input: anInput({ grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'none', minRuns: 0 }] }),
    });
    expect(await screen.findByText(/not unlocked/i)).toBeDefined();
  });

  it('marks a run whose gold figure is standing in', async () => {
    renderLog({
      input: anInput({ dungeons: [{ ...dungeon, goldEstimated: ['elite'] }] }),
    });
    const dot = await screen.findByRole('button', { name: /has no gold figure for elite/i });
    expect(dot.getAttribute('aria-label')).toMatch(/@zteria/i);
  });
});

describe('QuestLog roster management', () => {
  it('renames on blur', async () => {
    renderLog();
    const field = await screen.findByDisplayValue('Mage');
    fireEvent.change(field, { target: { value: 'Archmage' } });
    fireEvent.blur(field);
    await waitFor(() => {
      expect(vi.mocked(renameCharacter)).toHaveBeenCalledWith('c1', 'Archmage');
    });
  });

  it('does not rename when the name comes back unchanged', async () => {
    renderLog();
    fireEvent.blur(await screen.findByDisplayValue('Mage'));
    expect(vi.mocked(renameCharacter)).not.toHaveBeenCalled();
  });

  it('does not rename to an empty name', async () => {
    renderLog();
    const field = await screen.findByDisplayValue('Mage');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);
    expect(vi.mocked(renameCharacter)).not.toHaveBeenCalled();
  });

  it('warns that deleting a character takes its runs with it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderLog();
    fireEvent.click(await screen.findByRole('button', { name: /delete mage/i }));
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/runs/i);
    await waitFor(() => {
      expect(vi.mocked(deleteCharacter)).toHaveBeenCalledWith('c1');
    });
    confirmSpy.mockRestore();
  });

  it('keeps the character when the delete is not confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderLog();
    fireEvent.click(await screen.findByRole('button', { name: /delete mage/i }));
    expect(vi.mocked(deleteCharacter)).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('parks a character without deleting it', async () => {
    renderLog();
    fireEvent.click(await screen.findByLabelText('Include Mage in plan'));
    await waitFor(() => {
      expect(vi.mocked(toggleCharacterActive)).toHaveBeenCalledWith('c1', false);
    });
    expect(vi.mocked(deleteCharacter)).not.toHaveBeenCalled();
  });

  it('locks a parked character rather than hiding it', async () => {
    // The plan input has already dropped it, so the roster is the only place
    // left that can put it back.
    renderLog({
      input: anInput({ characters: [], grid: [], characterAttemptsLeft: {}, goldHeadroom: {} }),
      roster: [{ ...mage, is_active: false }],
    });
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.disabled).toBe(true);
    expect(
      (screen.getByRole('button', {
        name: /one more minimum run of abyss for mage/i,
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByLabelText('Include Mage in plan') as HTMLInputElement).checked).toBe(false);
  });

  it('writes the whole list 10 apart after a keyboard reorder', async () => {
    renderLog({ roster: [mage, rogue] });
    const grip = await screen.findByRole('button', { name: /reorder mage/i });

    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    fireEvent.keyDown(grip, { key: ' ' });

    await waitFor(() => {
      expect(vi.mocked(setCharacterOrder)).toHaveBeenCalledWith([
        { id: 'c2', sort_order: 10 },
        { id: 'c1', sort_order: 20 },
      ]);
    });
  });

  it('writes nothing when a reorder is cancelled', async () => {
    renderLog({ roster: [mage, rogue] });
    const grip = await screen.findByRole('button', { name: /reorder mage/i });

    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    fireEvent.keyDown(grip, { key: 'Escape' });

    expect(vi.mocked(setCharacterOrder)).not.toHaveBeenCalled();
  });
});

describe('QuestLog one character at a time', () => {
  it('renders only the selected characteritself, not every character', async () => {
    renderLog({ roster: [mage, rogue] });
    await screen.findByLabelText('Mage tier in Abyss');
    expect(screen.queryByLabelText('Rogue tier in Abyss')).toBe(null);
  });

  it('switches character from the roster', async () => {
    renderLog({ roster: [mage, rogue] });
    await screen.findByLabelText('Mage tier in Abyss');

    fireEvent.click(screen.getByRole('button', { name: /show rogue/i }));
    expect(await screen.findByLabelText('Rogue tier in Abyss')).toBeDefined();
    expect(screen.queryByLabelText('Mage tier in Abyss')).toBe(null);
  });

  it('switches character from the picker on a phone', async () => {
    stubMatchMedia(true);
    renderLog({ roster: [mage, rogue] });
    await screen.findByLabelText('Mage tier in Abyss');

    fireEvent.click(screen.getByRole('tab', { name: 'Rogue' }));
    expect(await screen.findByLabelText('Rogue tier in Abyss')).toBeDefined();
  });

  it('still writes the whole cell from the phone tree', async () => {
    stubMatchMedia(true);
    renderLog();
    fireEvent.change(await screen.findByLabelText('Mage tier in Abyss'), {
      target: { value: 'legend' },
    });
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 2,
      });
    });
  });
});

describe('QuestLog dungeon order', () => {
  const abyss = { ...dungeon, id: 'd1', name: 'Abyss', sort_order: 10, group_name: 'HexChess' };
  const rift = { ...dungeon, id: 'd2', name: 'Rift', sort_order: 20, group_name: 'HexChess' };
  const solo = { ...dungeon, id: 'd3', name: 'Solo', sort_order: 30, group_name: null };
  const input = anInput({
    dungeons: [abyss, rift, solo],
    accountAttemptsLeft: { d1: 18, d2: 18, d3: 18 },
    characterAttemptsLeft: { c1: { d1: 3, d2: 3, d3: 3 } },
  });

  it('puts the newest dungeon first', async () => {
    renderLog({ input });
    await screen.findByLabelText('Mage tier in Abyss');
    const names = screen.getAllByText(/^(Abyss|Rift|Solo)$/).map((n) => n.textContent);
    expect(names.indexOf('Solo')).toBeLessThan(names.indexOf('Abyss'));
  });

  it('bands the two dungeons of a family under one heading', async () => {
    renderLog({ input });
    await screen.findByLabelText('Mage tier in Abyss');
    const band = screen.getByText('HexChess').closest('.dungeon-group');
    expect(band?.querySelectorAll('.dungeon-row')).toHaveLength(2);
  });

  it('still shows a dungeon that belongs to no family', async () => {
    renderLog({ input });
    expect(await screen.findByLabelText('Mage tier in Solo')).toBeDefined();
  });
});
