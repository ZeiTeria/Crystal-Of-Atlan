// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia } from '../ui/testing/matchMedia';
import { resetDensity } from '../ui/density';
import GridScreen from './GridScreen';
import { listGrid, setGridCell, setGridCells } from '../data/grid';
import { listDungeons } from '../data/dungeons';
import {
  createCharacter,
  currentGameAccountId,
  deleteCharacter,
  listCharacters,
  renameCharacter,
  toggleCharacterActive,
  setCharacterOrder,
  type CharacterRow,
} from '../data/accounts';

vi.mock('../data/grid', () => ({ listGrid: vi.fn(), setGridCell: vi.fn(), setGridCells: vi.fn() }));
vi.mock('../data/dungeons', () => ({ listDungeons: vi.fn() }));
vi.mock('../data/accounts', () => ({
  currentGameAccountId: vi.fn(),
  listCharacters: vi.fn(),
  createCharacter: vi.fn(),
  renameCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  toggleCharacterActive: vi.fn(),
  setCharacterOrder: vi.fn(),
}));

afterEach(() => {
  resetDensity();
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
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
  default_tier: 'elite' as const,
  default_min_runs: 1,
  group_name: null,
  short_name: null,
};

const character = { id: 'c1', game_account_id: 'acc', name: 'Mage', class: null, sort_order: 0, is_active: true };

beforeEach(() => {
  vi.mocked(currentGameAccountId).mockResolvedValue('acc');
  vi.mocked(listCharacters).mockResolvedValue([character]);
  vi.mocked(listDungeons).mockResolvedValue([dungeon]);
  vi.mocked(listGrid).mockResolvedValue([
    { character_id: 'c1', dungeon_id: 'd1', tier: 'elite', min_runs: 2 },
  ]);
  vi.mocked(setGridCell).mockResolvedValue(undefined);
  vi.mocked(setGridCells).mockResolvedValue(undefined);
  vi.mocked(createCharacter).mockResolvedValue({ ...character, id: 'c2', name: 'Rogue' });
  vi.mocked(renameCharacter).mockResolvedValue(undefined);
  vi.mocked(deleteCharacter).mockResolvedValue(undefined);
  vi.mocked(toggleCharacterActive).mockResolvedValue(undefined);
  vi.mocked(setCharacterOrder).mockResolvedValue(undefined);
});

/** A promise the test controls the settlement of, to catch a mid-flight state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('GridScreen', () => {
  it('shows the stored tier and minimum for a pair', async () => {
    render(<GridScreen />);
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.value).toBe('elite');
    const min = screen.getByLabelText('Mage minimum runs in Abyss') as HTMLInputElement;
    expect(min.value).toBe('2');
  });

  it('defaults a pair with no row to the dungeon default tier', async () => {
    vi.mocked(listGrid).mockResolvedValue([]);
    render(<GridScreen />);
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.value).toBe('elite');
  });

  it('upserts a tier change immediately', async () => {
    render(<GridScreen />);
    const tier = await screen.findByLabelText('Mage tier in Abyss');
    fireEvent.change(tier, { target: { value: 'legend' } });
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 2,
      });
    });
  });

  it('writes a minimum on blur, as a number', async () => {
    render(<GridScreen />);
    const min = await screen.findByLabelText('Mage minimum runs in Abyss');
    fireEvent.change(min, { target: { value: '3' } });
    fireEvent.blur(min);
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 3,
      });
    });
  });

  it('does not write a half-typed number', async () => {
    // Typing "10" passes through "1". Writing on every keystroke saves that 1
    // and then re-renders the cell from the refreshed value, which takes the
    // focus out of the field the user is still typing into - so the 0 never
    // arrives and the minimum silently ends up as 1.
    render(<GridScreen />);
    const min = await screen.findByLabelText('Mage minimum runs in Abyss');
    fireEvent.change(min, { target: { value: '1' } });
    fireEvent.change(min, { target: { value: '10' } });
    expect(vi.mocked(setGridCell)).not.toHaveBeenCalled();

    fireEvent.blur(min);
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledExactlyOnceWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 10,
      });
    });
  });

  it('writes the whole cell when a tier changes, so the minimum is not reset', async () => {
    // A cell with no row yet shows the dungeon's defaults. Sending only the
    // tier makes the upsert insert a row whose min_runs takes the SCHEMA
    // default of 0, so the displayed minimum of 1 silently becomes 0.
    vi.mocked(listGrid).mockResolvedValue([]);
    render(<GridScreen />);
    const tier = await screen.findByLabelText('Mage tier in Abyss');
    fireEvent.change(tier, { target: { value: 'legend' } });
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
    vi.mocked(listGrid).mockResolvedValue([]);
    render(<GridScreen />);
    const min = await screen.findByLabelText('Mage minimum runs in Abyss');
    fireEvent.change(min, { target: { value: '3' } });
    fireEvent.blur(min);
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'elite',
        min_runs: 3,
      });
    });
  });

  it('says what to do when there is nothing to fill in', async () => {
    vi.mocked(listCharacters).mockResolvedValue([]);
    render(<GridScreen />);
    expect(await screen.findByText(/add a character/i)).toBeDefined();
  });
});

// Ported from the deleted CharactersScreen suite: adding, renaming, deleting
// and parking a character all live in the Grid's row headers now, and none of
// it was covered after the move.
describe('GridScreen character management', () => {
  it('adds a character to the current account', async () => {
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(vi.mocked(createCharacter)).toHaveBeenCalledWith('acc', 'Rogue');
    });
  });

  it('trims whitespace and refuses an empty name', async () => {
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    expect(vi.mocked(createCharacter)).not.toHaveBeenCalled();
  });

  it('disables Add while the trimmed draft is empty', async () => {
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    const addButton = screen.getByRole('button', { name: /add character/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: '   ' } });
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    expect(addButton.disabled).toBe(false);
  });

  it('disables Add immediately and creates only once when clicked twice before the create settles', async () => {
    const gate = deferred<CharacterRow>();
    vi.mocked(createCharacter).mockReturnValue(gate.promise);
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    const addButton = screen.getByRole('button', { name: /add character/i }) as HTMLButtonElement;

    fireEvent.click(addButton);
    expect(addButton.disabled).toBe(true);
    fireEvent.click(addButton); // a disabled button must not fire a second createCharacter

    gate.resolve({ ...character, id: 'c2', name: 'Rogue' });
    await waitFor(() => {
      expect(vi.mocked(createCharacter)).toHaveBeenCalledTimes(1);
    });
  });

  it('renames on blur', async () => {
    render(<GridScreen />);
    const field = await screen.findByDisplayValue('Mage');
    fireEvent.change(field, { target: { value: 'Archmage' } });
    fireEvent.blur(field);
    await waitFor(() => {
      expect(vi.mocked(renameCharacter)).toHaveBeenCalledWith('c1', 'Archmage');
    });
  });

  it('does not rename when the name comes back unchanged', async () => {
    render(<GridScreen />);
    const field = await screen.findByDisplayValue('Mage');
    fireEvent.blur(field);
    expect(vi.mocked(renameCharacter)).not.toHaveBeenCalled();
  });

  it('warns that deleting a character takes its runs with it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.click(screen.getByRole('button', { name: /delete mage/i }));
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/runs/i);
    await waitFor(() => {
      expect(vi.mocked(deleteCharacter)).toHaveBeenCalledWith('c1');
    });
    confirmSpy.mockRestore();
  });

  it('keeps the character when the delete is not confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.click(screen.getByRole('button', { name: /delete mage/i }));
    expect(vi.mocked(deleteCharacter)).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('parks a character without deleting it', async () => {
    render(<GridScreen />);
    const include = await screen.findByLabelText('Include Mage in plan');
    fireEvent.click(include);
    await waitFor(() => {
      expect(vi.mocked(toggleCharacterActive)).toHaveBeenCalledWith('c1', false);
    });
    expect(vi.mocked(deleteCharacter)).not.toHaveBeenCalled();
  });

  it("locks a parked character's row rather than hiding it", async () => {
    vi.mocked(listCharacters).mockResolvedValue([{ ...character, is_active: false }]);
    render(<GridScreen />);
    const tier = (await screen.findByLabelText('Mage tier in Abyss')) as HTMLSelectElement;
    expect(tier.disabled).toBe(true);
    const min = screen.getByLabelText('Mage minimum runs in Abyss') as HTMLInputElement;
    expect(min.disabled).toBe(true);
  });
});

describe('GridScreen columns', () => {
  const abyss = { ...dungeon, id: 'd1', name: 'Abyss', sort_order: 10, group_name: 'HexChess' };
  const rift = { ...dungeon, id: 'd2', name: 'Rift', sort_order: 20, group_name: 'HexChess' };
  const solo = { ...dungeon, id: 'd3', name: 'Solo', sort_order: 30, group_name: null };

  beforeEach(() => {
    vi.mocked(listDungeons).mockResolvedValue([abyss, rift, solo]);
  });

  it('puts the newest dungeon in the leftmost column', async () => {
    render(<GridScreen />);
    await screen.findByLabelText('Mage tier in Abyss');
    // Queried by title, not by text: the label itself changes with the density
    // toggle, but the title is always the full name.
    const headers = screen.getAllByRole('columnheader').map((h) => h.getAttribute('title') ?? '');
    expect(headers.indexOf('Solo')).toBeLessThan(headers.indexOf('Abyss'));
  });

  it('bands the two dungeons of a family under one heading', async () => {
    render(<GridScreen />);
    await screen.findByLabelText('Mage tier in Abyss');
    expect(screen.getByText('HexChess').closest('th')?.getAttribute('colspan')).toBe('2');
  });

  it('still shows a dungeon that belongs to no family', async () => {
    render(<GridScreen />);
    expect(await screen.findByLabelText('Mage tier in Solo')).toBeDefined();
  });
});

describe('GridScreen templates when adding a character', () => {
  const rogue = { ...character, id: 'c2', name: 'Rogue', sort_order: 20 };

  async function addNamed(name: string, template?: string) {
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: name } });
    if (template) fireEvent.change(screen.getByLabelText('Template'), { target: { value: template } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
  }

  it('writes no grid rows for the default blank template', async () => {
    // A pair with no row already shows the dungeon's defaults, so writing them
    // out would only freeze today's values.
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    await addNamed('Rogue');
    await waitFor(() => expect(vi.mocked(createCharacter)).toHaveBeenCalled());
    expect(vi.mocked(setGridCells)).not.toHaveBeenCalled();
  });

  it('sets every dungeon to the chosen tier', async () => {
    vi.mocked(createCharacter).mockResolvedValue({ ...character, id: 'new', name: 'Rogue' });
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    await addNamed('Rogue', 'tier:legend');
    await waitFor(() => {
      expect(vi.mocked(setGridCells)).toHaveBeenCalledWith([
        { character_id: 'new', dungeon_id: 'd1', tier: 'legend', min_runs: 1 },
      ]);
    });
  });

  it('copies an existing character, defaults included', async () => {
    vi.mocked(createCharacter).mockResolvedValue({ ...character, id: 'new', name: 'Rogue' });
    vi.mocked(listGrid).mockResolvedValue([
      { character_id: 'c1', dungeon_id: 'd1', tier: 'story', min_runs: 3 },
    ]);
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    await addNamed('Rogue', 'char:c1');
    await waitFor(() => {
      expect(vi.mocked(setGridCells)).toHaveBeenCalledWith([
        { character_id: 'new', dungeon_id: 'd1', tier: 'story', min_runs: 3 },
      ]);
    });
  });

  it('offers every existing character as a template', async () => {
    vi.mocked(listCharacters).mockResolvedValue([character, rogue]);
    render(<GridScreen />);
    const select = (await screen.findByLabelText('Template')) as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).toContain('char:c1');
    expect(values).toContain('char:c2');
    expect(values).toContain('tier:legend');
    expect(values).toContain('blank');
  });

  it('no longer clutters the character row with a copy control', async () => {
    // It moved to the Add block: five controls in a sticky first column is
    // unreadable when the matrix is scrolled sideways.
    vi.mocked(listCharacters).mockResolvedValue([character, rogue]);
    render(<GridScreen />);
    await screen.findByDisplayValue('Mage');
    expect(screen.queryByLabelText('Copy grid onto Rogue from')).toBe(null);
  });
});

describe('GridScreen character reordering', () => {
  const rogue = { ...character, id: 'c2', name: 'Rogue', sort_order: 20 };

  it('writes the whole list 10 apart after a keyboard reorder', async () => {
    vi.mocked(listCharacters).mockResolvedValue([character, rogue]);
    render(<GridScreen />);
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
    vi.mocked(listCharacters).mockResolvedValue([character, rogue]);
    render(<GridScreen />);
    const grip = await screen.findByRole('button', { name: /reorder mage/i });

    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    fireEvent.keyDown(grip, { key: 'Escape' });

    expect(vi.mocked(setCharacterOrder)).not.toHaveBeenCalled();
  });
});

describe('GridScreen on a phone', () => {
  const rogue = { ...character, id: 'c2', name: 'Rogue', sort_order: 20 };

  it('shows one character at a time instead of the matrix', async () => {
    stubMatchMedia(true);
    vi.mocked(listCharacters).mockResolvedValue([character, rogue]);
    render(<GridScreen />);
    await screen.findByLabelText('Mage tier in Abyss');

    // Rogue's controls are not rendered at all - the phone tree is one
    // character, not a narrow version of twelve.
    expect(screen.queryByLabelText('Rogue tier in Abyss')).toBe(null);
    expect(screen.getByRole('tab', { name: 'Rogue' })).toBeDefined();
  });

  it('switches character from the picker', async () => {
    stubMatchMedia(true);
    vi.mocked(listCharacters).mockResolvedValue([character, rogue]);
    render(<GridScreen />);
    await screen.findByLabelText('Mage tier in Abyss');

    fireEvent.click(screen.getByRole('tab', { name: 'Rogue' }));
    expect(await screen.findByLabelText('Rogue tier in Abyss')).toBeDefined();
    expect(screen.queryByLabelText('Mage tier in Abyss')).toBe(null);
  });

  it('still writes the whole cell from the phone tree', async () => {
    stubMatchMedia(true);
    render(<GridScreen />);
    const tier = await screen.findByLabelText('Mage tier in Abyss');
    fireEvent.change(tier, { target: { value: 'legend' } });
    await waitFor(() => {
      expect(vi.mocked(setGridCell)).toHaveBeenCalledWith('c1', 'd1', {
        tier: 'legend',
        min_runs: 2,
      });
    });
  });
});

describe('GridScreen density', () => {
  it('shows a short label by default, because nine full names do not fit', async () => {
    vi.mocked(listDungeons).mockResolvedValue([{ ...dungeon, name: 'Abyss', short_name: 'ABY' }]);
    render(<GridScreen />);
    await screen.findByLabelText('Mage tier in Abyss');
    // The header also carries its cap counter, so match the label, not the
    // whole accessible name.
    expect(screen.getByRole('columnheader', { name: /^ABY/ })).toBeDefined();
  });

  it('falls back to a suggested label when none was written', async () => {
    vi.mocked(listDungeons).mockResolvedValue([
      { ...dungeon, name: 'Queen Coronation', group_name: 'HexChess', short_name: null },
    ]);
    render(<GridScreen />);
    await screen.findByLabelText('Mage tier in Queen Coronation');
    expect(screen.getByRole('columnheader', { name: /^HQC/ })).toBeDefined();
  });

  it('shows the full name when switched to detailed', async () => {
    vi.mocked(listDungeons).mockResolvedValue([{ ...dungeon, name: 'Abyss', short_name: 'ABY' }]);
    render(<GridScreen />);
    await screen.findByLabelText('Mage tier in Abyss');
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    expect(await screen.findByRole('columnheader', { name: /^Abyss/ })).toBeDefined();
  });

  it('keeps the full name reachable on hover whatever the density', async () => {
    vi.mocked(listDungeons).mockResolvedValue([{ ...dungeon, name: 'Abyss', short_name: 'ABY' }]);
    render(<GridScreen />);
    const header = await screen.findByRole('columnheader', { name: /^ABY/ });
    expect(header.getAttribute('title')).toBe('Abyss');
  });
});
