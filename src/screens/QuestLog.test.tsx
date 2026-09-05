// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuestLog from './QuestLog';
import { setGridCell, type GridRow } from '../data/grid';
import {
  deleteCharacter,
  renameCharacter,
  setCharacterClass,
  setCharacterOrder,
  toggleCharacterActive,
  type CharacterRow,
} from '../data/accounts';
import type { PlanAssignment, PlanInput } from '../engine/types';
import { stubMatchMedia } from '../ui/testing/matchMedia';

vi.mock('../data/grid', () => ({ setGridCell: vi.fn() }));
vi.mock('../data/accounts', () => ({
  renameCharacter: vi.fn(),
  setCharacterClass: vi.fn(),
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
  manual: false,
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
    grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 2, maxRuns: 3 }],
    accountAttemptsLeft: { d1: 18 },
    characterAttemptsLeft: { c1: { d1: 3 } },
    goldHeadroom: { c1: 1_000_000 },
    settings: { goldCap: 1_000_000, goldResetWeekday: 1, resetHour: 6, timeZone: 'UTC' },
    ...overrides,
  };
}

/** What the database actually holds for Mage in Abyss. */
const storedRow: GridRow = {
  character_id: 'c1',
  dungeon_id: 'd1',
  tier: 'elite',
  min_runs: 2,
  max_runs: null,
};

/** The screen above owns the write-then-refresh; here it is just the write. */
const mutate = vi.fn(async (write: () => Promise<void>) => {
  await write();
});

/** The cheap path, for writes the solver cannot see. */
const relabel = vi.fn(async (write: () => Promise<void>) => {
  await write();
});

function renderLog(
  opts: {
    input?: PlanInput;
    assignments?: PlanAssignment[];
    gridRows?: GridRow[];
    roster?: CharacterRow[];
    onAddClick?: () => void;
  } = {},
) {
  return render(
    <QuestLog
      input={opts.input ?? anInput()}
      assignments={opts.assignments ?? []}
      gridRows={opts.gridRows ?? [storedRow]}
      roster={opts.roster ?? [mage]}
      mutate={mutate}
      relabel={relabel}
      onAddClick={opts.onAddClick}
    />,
  );
}

/** The tier opens a menu now rather than being a native select. */
async function chooseTier(character: string, dungeon: string, tier: string) {
  fireEvent.click(await screen.findByLabelText(`${character} tier in ${dungeon}`));
  fireEvent.click(screen.getByRole('button', { name: `${dungeon} at ${tier}` }));
}

function shownTier(character: string, dungeon: string) {
  return screen.getByLabelText(`${character} tier in ${dungeon}`).textContent;
}

beforeEach(() => {
  vi.mocked(setGridCell).mockResolvedValue(undefined);
  vi.mocked(renameCharacter).mockResolvedValue(undefined);
  vi.mocked(setCharacterClass).mockResolvedValue(undefined);
  vi.mocked(deleteCharacter).mockResolvedValue(undefined);
  vi.mocked(toggleCharacterActive).mockResolvedValue(undefined);
  vi.mocked(setCharacterOrder).mockResolvedValue(undefined);
  mutate.mockClear();
  relabel.mockClear();
});

describe('QuestLog cells', () => {
  it('shows the stored tier and minimum for a pair', async () => {
    renderLog();
    await screen.findByLabelText('Mage tier in Abyss');
    expect(shownTier('Mage', 'Abyss')).toBe('elite');
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('2');
  });

  it('defaults a pair with no row to the dungeon default tier and minimum', async () => {
    renderLog({ gridRows: [] });
    await screen.findByLabelText('Mage tier in Abyss');
    expect(shownTier('Mage', 'Abyss')).toBe('elite');
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('1');
  });

  it('shows a stored none instead of falling back to the default', async () => {
    // The plan input drops a `none` pair entirely - it is not a decision the
    // solver has to make - so reading the tier from there showed the dungeon's
    // default instead, and choosing `none` looked like it had not saved.
    renderLog({ gridRows: [{ ...storedRow, tier: 'none' }], input: anInput({ grid: [] }) });
    await screen.findByLabelText('Mage tier in Abyss');
    expect(shownTier('Mage', 'Abyss')).toBe('none');
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('2');
  });

  it('changing the difficulty never moves the minimum', async () => {
    renderLog();
    await chooseTier('Mage', 'Abyss', 'none');
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'none',
        min_runs: 2, max_runs: 3,
      });
    });
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('2');
  });

  it('shows the new difficulty before the write lands', async () => {
    // Same reason the stepper is optimistic: the write re-reads and re-solves
    // the whole plan, and waiting for that before the word changed made every
    // choice feel like it had not registered.
    let settle!: () => void;
    mutate.mockImplementationOnce(async (write) => {
      await write();
      await new Promise<void>((resolve) => {
        settle = resolve;
      });
    });
    renderLog();
    await chooseTier('Mage', 'Abyss', 'legend');
    expect(shownTier('Mage', 'Abyss')).toBe('legend');
    settle();
  });

  it('upserts a tier change immediately', async () => {
    renderLog();
    await chooseTier('Mage', 'Abyss', 'legend');
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 2, max_runs: 3,
      });
    });
  });

  it('writes the whole cell when a tier changes, so the minimum is not reset', async () => {
    // A pair with no row yet shows the dungeon's defaults. Sending only the
    // tier makes the upsert insert a row whose min_runs takes the SCHEMA
    // default of 0, so the displayed minimum of 1 silently becomes 0.
    renderLog({ gridRows: [] });
    await chooseTier('Mage', 'Abyss', 'legend');
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 1, max_runs: 3,
      });
    });
  });

  it('writes the whole cell when a minimum changes, so the tier is not locked to none', async () => {
    // The same hole in the other direction, and worse: an inserted row would
    // take tier 'none', which means "cannot enter" - the planner drops the pair
    // entirely rather than merely planning it badly.
    renderLog({ gridRows: [] });
    fireEvent.click(
      await screen.findByRole('button', { name: /one more minimum run of abyss for mage/i }),
    );
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 2, max_runs: 3,
      });
    });
  });

  it('drags the minimum down when the maximum steps below it', async () => {
    // The pair moves together once it is equal, so a cell at 1/1 goes to 0/0
    // rather than to an impossible minimum 1 / maximum 0.
    renderLog({ gridRows: [{ ...storedRow, min_runs: 1, max_runs: 1 }] });
    fireEvent.click(screen.getByRole('button', { name: /one fewer maximum run of abyss for mage/i }));
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 0, max_runs: 0,
      });
    });
  });

  it('drags the maximum up when the minimum steps above it', async () => {
    // The same rule in the other direction: 1/1 goes to 2/2.
    renderLog({ gridRows: [{ ...storedRow, min_runs: 1, max_runs: 1 }] });
    fireEvent.click(screen.getByRole('button', { name: /one more minimum run of abyss for mage/i }));
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 2, max_runs: 2,
      });
    });
  });

  it('leaves the tier alone when the maximum reaches zero', async () => {
    // Maximum 0 means "I do not want this character here this week". It is NOT
    // tier `none`, which means the difficulty has not been cleared at all -
    // writing `none` here would drop the pair from the planner permanently.
    renderLog({ gridRows: [{ ...storedRow, min_runs: 0, max_runs: 1 }] });
    fireEvent.click(screen.getByRole('button', { name: /one fewer maximum run of abyss for mage/i }));
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 0, max_runs: 0,
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
        min_runs: 1, max_runs: 3,
      });
    });
  });

  it('moves the number before the write lands', async () => {
    // A write re-reads and re-solves the whole plan, which is a wasm round
    // trip. Waiting for it before moving the number made every click feel
    // broken; the number is local until the write catches up.
    renderLog();
    fireEvent.click(
      await screen.findByRole('button', { name: /one more minimum run of abyss for mage/i }),
    );
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('3');
    expect(vi.mocked(setGridCell)).not.toHaveBeenCalled();
  });

  it('writes once for a run of clicks, not once per click', async () => {
    renderLog({ gridRows: [{ ...storedRow, min_runs: 0 }] });
    const up = await screen.findByRole('button', {
      name: /one more minimum run of abyss for mage/i,
    });
    fireEvent.click(up);
    fireEvent.click(up);
    fireEvent.click(up);
    expect(screen.getByLabelText('Mage minimum runs in Abyss').textContent).toBe('3');
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledExactlyOnceWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 3, max_runs: 3,
      });
    });
  });

  it('cannot step past the per-character cap, or below zero', async () => {
    renderLog({ gridRows: [{ ...storedRow, min_runs: 3 }] });
    const up = (await screen.findByRole('button', {
      name: /one more minimum run of abyss for mage/i,
    })) as HTMLButtonElement;
    expect(up.disabled).toBe(true);

    cleanup();
    renderLog({ gridRows: [{ ...storedRow, min_runs: 0 }] });
    const down = (await screen.findByRole('button', {
      name: /one fewer minimum run of abyss for mage/i,
    })) as HTMLButtonElement;
    expect(down.disabled).toBe(true);
  });

  it('prices a run at the tier the character actually runs, not a fixed one', async () => {
    // gold.elite is 3 and gold.story is 2: reading the wrong one is invisible
    // until the two differ.
    renderLog({ gridRows: [{ ...storedRow, tier: 'story', min_runs: 0 }] });
    expect(await screen.findByText(/2 per run/)).toBeDefined();
  });

  it('says a dungeon is not unlocked rather than pricing it', async () => {
    renderLog({ gridRows: [{ ...storedRow, tier: 'none', min_runs: 0 }] });
    expect(await screen.findByText(/not unlocked/i)).toBeDefined();
  });

  it('shows the gold the plan earns, not the gold already earned', async () => {
    // Runs are never logged, so "earned" is permanently zero - this used to
    // read 0 of 1,000,000 with an empty meter for every character, forever.
    renderLog({
      assignments: [
        { characterId: 'c1', dungeonId: 'd1', runs: 2, goldPerRun: 3, goldTotal: 6 },
      ],
    });
    await screen.findByText(/2 runs planned/);
    // Scoped to the header figure: the same total also appears on its row.
    expect(document.querySelector('.qh-gold-val')?.textContent).toBe('6');
    expect(document.querySelector('.qh-meter-fill')?.getAttribute('style')).not.toContain(
      'width: 0%',
    );
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
  it('sets a class from the portrait, which is the thing showing it', async () => {
    renderLog();
    fireEvent.click(await screen.findByRole('button', { name: /set mage's class/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Set class to Warlock' }));
    await waitFor(() => {
      expect(vi.mocked(setCharacterClass)).toHaveBeenCalledWith('c1', 'Warlock');
    });
  });

  it('names the current class on the control once one is set', async () => {
    renderLog({ roster: [{ ...mage, class: 'Warlock' }] });
    expect(
      await screen.findByRole('button', { name: /mage is a warlock\. change class/i }),
    ).toBeDefined();
  });

  it('clears a class back to none', async () => {
    // A character without a class is a real state, not a missing value.
    renderLog({ roster: [{ ...mage, class: 'Warlock' }] });
    fireEvent.click(await screen.findByRole('button', { name: /change class/i }));
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => {
      expect(vi.mocked(setCharacterClass)).toHaveBeenCalledWith('c1', null);
    });
  });

  it('offers no clear when there is no class to clear', async () => {
    renderLog();
    fireEvent.click(await screen.findByRole('button', { name: /set mage's class/i }));
    expect(screen.queryByRole('button', { name: /^clear$/i })).toBe(null);
  });

  it('closes the class picker on Escape', async () => {
    renderLog();
    fireEvent.click(await screen.findByRole('button', { name: /set mage's class/i }));
    expect(screen.getByRole('button', { name: 'Set class to Warlock' })).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Set class to Warlock' })).toBe(null),
    );
  });

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

  it('renames without re-solving the plan', async () => {
    // A name is invisible to the solver. Re-reading five tables and running the
    // wasm solve to see it change is waste the user can feel.
    renderLog();
    const field = await screen.findByDisplayValue('Mage');
    fireEvent.change(field, { target: { value: 'Archmage' } });
    fireEvent.blur(field);
    await waitFor(() => expect(vi.mocked(renameCharacter)).toHaveBeenCalled());
    expect(relabel).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('sets a class without re-solving the plan', async () => {
    renderLog();
    fireEvent.click(await screen.findByRole('button', { name: /set mage's class/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Set class to Warlock' }));
    await waitFor(() => expect(vi.mocked(setCharacterClass)).toHaveBeenCalled());
    expect(relabel).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('re-solves when parking a character, which the solver DOES see', async () => {
    renderLog();
    fireEvent.click(await screen.findByLabelText('Include Mage in plan'));
    await waitFor(() => expect(vi.mocked(toggleCharacterActive)).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalled();
  });

  it('re-solves when a minimum changes', async () => {
    renderLog();
    fireEvent.click(
      await screen.findByRole('button', { name: /one fewer minimum run of abyss for mage/i }),
    );
    await waitFor(() => expect(vi.mocked(setGridCell)).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalled();
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
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLButtonElement;
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
    await chooseTier('Mage', 'Abyss', 'legend');
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 2, max_runs: 3,
      });
    });
  });

  /*
   * Two identical steppers sat side by side with nothing on screen saying
   * which was the minimum and which the maximum, and the tier and gold
   * columns were unlabelled too. The aria-labels were right the whole time,
   * so only a test that reads what is VISIBLE catches this.
   */
  it('names every control in a dungeon row on screen, not just to a reader', async () => {
    renderLog();
    await screen.findByLabelText('Mage tier in Abyss');

    const row = screen.getByText('Abyss').closest('.dungeon-row');
    expect(row).not.toBeNull();
    const labels = [...row!.querySelectorAll('.d-ctl-label')].map((n) => n.textContent);
    expect(labels).toEqual(['Difficulty', 'Min', 'Max', 'Gold']);
  });

  /*
   * The bug this guards: every way to add a character lived in the roster,
   * which is the desktop branch, and QuestLog's own "Add character" button
   * only renders in the zero-character empty state. So on a phone, the moment
   * you had one character you could never make a second. CharacterPicker's
   * own tests cover the button; this covers the wiring, which is what broke.
   */
  it('offers a way to add a character from the phone tree', async () => {
    const onAddClick = vi.fn();
    stubMatchMedia(true);
    renderLog({ roster: [mage], onAddClick });
    await screen.findByLabelText('Mage tier in Abyss');

    fireEvent.click(screen.getByRole('button', { name: 'Add character' }));
    expect(onAddClick).toHaveBeenCalledOnce();
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
