// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanScreen from './PlanScreen';
import { loadPlanState } from '../data/loadPlanInput';
import {
  createCharacter,
  currentGameAccountId,
  listCharacters,
  type CharacterRow,
} from '../data/accounts';
import { setGridCells, type GridRow } from '../data/grid';
import type { PlanInput } from '../engine/types';
import { stubMatchMedia } from '../ui/testing/matchMedia';
import { resetDensity } from '../ui/density';

vi.mock('../data/loadPlanInput', () => ({ loadPlanState: vi.fn() }));
vi.mock('../data/grid', () => ({ setGridCell: vi.fn(), setGridCells: vi.fn() }));
// The roster is read separately from the plan input: the input has already
// dropped parked characters, and the log has to be able to unpark one.
vi.mock('../data/accounts', () => ({
  currentGameAccountId: vi.fn(),
  listCharacters: vi.fn(),
  createCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  renameCharacter: vi.fn(),
  toggleCharacterActive: vi.fn(),
  setCharacterOrder: vi.fn(),
}));

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
  manual: false,
};

function anInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    characters: [{ id: 'c1', name: 'Mage', class: 'Magister' }],
    dungeons: [dungeon],
    grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0, maxRuns: 3 }],
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

/** The single read the screen makes: derived input plus the rows behind it. */
function aState(
  overrides: Partial<PlanInput> = {},
  rows: { characters?: CharacterRow[]; grid?: GridRow[]; maxCharacters?: number } = {},
) {
  return {
    input: anInput(overrides),
    settings: {
      id: true as const,
      gold_cap_per_character: 1_000_000,
      gold_reset_weekday: 1,
      reset_hour: 6,
      server_timezone: 'UTC',
      stone_rate: 0.4,
      max_characters: rows.maxCharacters ?? 12,
    },
    characters: rows.characters ?? [MAGE],
    grid: rows.grid ?? [],
  };
}

const MAGE: CharacterRow = {
  id: 'c1',
  game_account_id: 'acc',
  name: 'Mage',
  class: 'Magister',
  sort_order: 10,
  is_active: true,
};

beforeEach(() => {
  vi.mocked(currentGameAccountId).mockResolvedValue('acc');
  vi.mocked(listCharacters).mockResolvedValue([MAGE]);
  vi.mocked(createCharacter).mockResolvedValue({ ...MAGE, id: 'new', name: 'Rogue' });
  vi.mocked(setGridCells).mockResolvedValue(undefined);
  vi.mocked(loadPlanState).mockResolvedValue(aState());
});

/** Opens the add form from the board and fills in a name. */
async function openAddForm(name: string) {
  await screen.findAllByText('Mage');
  fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));
  fireEvent.change(await screen.findByLabelText('New character name'), { target: { value: name } });
}

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
    // One card per dungeon, and the character's row inside it carries what
    // those runs are worth - 3 runs of elite at 30. Scoped to the card: the
    // same total is also a headline stat, and this is about the row.
    const board = document.querySelector('.board-grid') as HTMLElement;
    const card = within(board).getByText('Abyss').closest('.board-card') as HTMLElement;
    expect(within(card).getByText('Mage')).toBeDefined();
    expect(within(card).getByText('90')).toBeDefined();
  });

  it('colours an attempt by the difficulty it is run at, not by who runs it', async () => {
    // The who-list already says who. The slot is the attempt being spent, and
    // what decides its worth is the difficulty.
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    const board = document.querySelector('.board-grid') as HTMLElement;
    const card = within(board).getByText('Abyss').closest('.board-card') as HTMLElement;
    const filled = card.querySelectorAll('.slot.filled');
    expect(filled).toHaveLength(3);
    for (const slot of filled) {
      expect(slot.getAttribute('style')).toContain('--tier-elite');
    }
  });

  it('says what each character runs, and how many times', async () => {
    // The board answers "who runs this dungeon"; this answers it the other way
    // round, which is the question you ask before playing one character.
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    const card = document.querySelector('.char-card') as HTMLElement;
    expect(within(card).getByText('Mage')).toBeDefined();
    expect(within(card).getByText('Abyss')).toBeDefined();
    // 3 runs of elite at 30 gold.
    expect(within(card).getByText('3×')).toBeDefined();
    expect(within(card).getByText('elite')).toBeDefined();
    // The row's gold and the card's total, which happen to match on one dungeon.
    expect(card.querySelector('.char-row-gold')?.textContent).toBe('90');
    expect(card.querySelector('.char-card-gold')?.textContent).toBe('90');
  });

  it('says so plainly when a character has nothing planned', async () => {
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ accountAttemptsLeft: { d1: 0 } }),
    );
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(document.querySelector('.char-card-none')?.textContent).toMatch(/nothing planned/i);
  });

  it('picks one character out of every card when you point at it', async () => {
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({
        characters: [
          { id: 'c1', name: 'Mage', class: 'Magister' },
          { id: 'c2', name: 'Rogue', class: 'Fighter' },
        ],
        grid: [
          { characterId: 'c1', dungeonId: 'd1', tier: 'elite', minRuns: 0, maxRuns: 3 },
          { characterId: 'c2', dungeonId: 'd1', tier: 'elite', minRuns: 0, maxRuns: 3 },
        ],
        characterAttemptsLeft: { c1: { d1: 3 }, c2: { d1: 3 } },
        goldHeadroom: { c1: 1_000_000, c2: 1_000_000 },
      }),
    );
    render(<PlanScreen />);
    // The name is on the roster tile and again in the who-row; this is the tile.
    await screen.findAllByText('Mage');
    const tile = screen
      .getAllByText('Mage')
      .map((n) => n.closest('.roster-tile'))
      .find((n) => n !== null) as HTMLElement;

    fireEvent.mouseEnter(tile);
    const dimmed = document.querySelectorAll('.slot.filled.dim');
    expect(dimmed.length).toBeGreaterThan(0);
    for (const slot of dimmed) {
      expect(slot.getAttribute('data-character')).toBe('c2');
    }

    fireEvent.mouseLeave(tile);
    expect(document.querySelectorAll('.slot.filled.dim')).toHaveLength(0);
  });

  it('says there is nothing to decide when nothing is contended', async () => {
    render(<PlanScreen />);
    expect(await screen.findByText(/no choices to make/i)).toBeDefined();
  });

  it('reports an impossible minimum instead of a plan', async () => {
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({
        grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'none', minRuns: 2, maxRuns: 3 }],
      }),
    );
    render(<PlanScreen />);
    expect(await screen.findByText(/has not unlocked it/i)).toBeDefined();
  });

  it('says what to do when there is nothing to plan', async () => {
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ characters: [], grid: [], characterAttemptsLeft: {}, goldHeadroom: {} },
        { characters: [] }),
    );
    render(<PlanScreen />);
    expect(await screen.findByRole('button', { name: /add character/i })).toBeDefined();
  });

  it('reports the tighter of the two ceilings, not their sum or the wrong one, and renders a stopping reason', async () => {
    // goldHeadroom (50) is deliberately tighter than what the attempts could
    // earn (min(characterAttempts, accountAttempts) * goldPerRun = 3 * 30 = 90).
    // Math.max, +, or dropping either term would all print something other than 50.
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ goldHeadroom: { c1: 50 } }));
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(await screen.findByText(/at most 50/)).toBeDefined();
    expect(screen.getByText(/50 by the gold cap, 90 by attempts/)).toBeDefined();

    // The reason is no longer prose under a heading: it is a "?" beside the
    // leftover count on the card, which only appears when the leftover is not
    // zero. The strip above leads with what the week has spent.
    expect(screen.getByText(/attempts used/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /cannot be used/i })).toBeDefined();
  });

  it('reports the tighter of the two ceilings when the attempt ceiling is the binding one', async () => {
    // goldHeadroom is deliberately generous (1,000,000) so it cannot be the
    // binding term; accountAttemptsLeft (1) makes the attempt ceiling
    // 1 * 30 = 30. Math.min(a, b) and plain `a` (goldCeiling) would both
    // render 1,000,000 here, so only the attempts term being present is what
    // makes this case fail on Math.max, `+`, or a dropped attempts term.
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ goldHeadroom: { c1: 1_000_000 }, accountAttemptsLeft: { d1: 1 } }),
    );
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(await screen.findByText(/at most 30/)).toBeDefined();
    expect(screen.getByText(/1,000,000 by the gold cap, 30 by attempts/)).toBeDefined();
  });

  it('does not render a table when the initial load fails, and offers a retry', async () => {
    vi.mocked(loadPlanState).mockRejectedValueOnce(
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
    vi.mocked(loadPlanState).mockRejectedValueOnce(
      new NamedError('FetchError', 'could not reach supabase'),
    );
    render(<PlanScreen />);
    expect(await screen.findByText(/could not reach supabase/i)).toBeDefined();

    const gate = deferred<ReturnType<typeof aState>>();
    vi.mocked(loadPlanState).mockReturnValue(gate.promise);
    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    // While the retry is in flight, the old failure must not still be on
    // screen looking unchanged — progress should be visible instead.
    await waitFor(() => {
      expect(screen.queryByText(/could not reach supabase/i)).toBeNull();
    });
    expect(screen.getByText(/solving/i)).toBeDefined();

    gate.resolve(aState());
    expect(await screen.findAllByText('Mage')).toBeDefined();
  });

  it('writes a row for every dungeon, even ones left on the default', async () => {
    // A dungeon's default is a template for MAKING a character, not a live link
    // to it. Leaving a pair unwritten made a later catalogue edit reach back and
    // change a character the player had already told us about.
    render(<PlanScreen />);
    await openAddForm('Rogue');
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      // The newest class, which is what a player adding a character usually
      // wants - and it is display-only either way.
      expect(vi.mocked(createCharacter)).toHaveBeenCalledWith('acc', 'Rogue', 'Sugariff');
    });
    await waitFor(() => {
      expect(vi.mocked(setGridCells)).toHaveBeenCalledWith([
        { character_id: 'new', dungeon_id: 'd1', tier: 'elite', min_runs: 1, max_runs: null },
      ]);
    });
  });

  it('writes the tiers that differ from the defaults', async () => {
    render(<PlanScreen />);
    await openAddForm('Rogue');
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'tier:legend' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(vi.mocked(setGridCells)).toHaveBeenCalledWith([
        { character_id: 'new', dungeon_id: 'd1', tier: 'legend', min_runs: 1, max_runs: null },
      ]);
    });
  });
});

describe('PlanScreen on a phone', () => {

  it('refuses to add past the cap, and says so', async () => {
    vi.mocked(loadPlanState).mockResolvedValue(aState({}, { maxCharacters: 1 }));
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    const add = screen.getByRole('button', { name: /1 \/ 1|\+ add/i }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(screen.queryByLabelText('New character name')).toBe(null);
  });

  it('reads the whole plan once per refresh, not the same tables twice', async () => {
    // characters, the grid and the settings all arrive with the plan. Reading
    // them again apiece meant three extra round trips after every write.
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(vi.mocked(loadPlanState)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listCharacters)).not.toHaveBeenCalled();
  });

  it('resolves the account once, not on every refresh', async () => {
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));
    fireEvent.click(await screen.findByRole('button', { name: /add character/i }));
    await waitFor(() => expect(vi.mocked(createCharacter)).toHaveBeenCalled());
    expect(vi.mocked(currentGameAccountId)).toHaveBeenCalledTimes(1);
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
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ dungeons: [{ ...dungeon, goldEstimated: ['solo', 'legend'] }] }),
    );
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(screen.queryAllByRole('button', { name: /has no gold figure/i })).toHaveLength(0);
  });

  it('marks the cell when the difficulty it actually runs has no figure', async () => {
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ dungeons: [{ ...dungeon, goldEstimated: ['elite'] }] }),
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
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
    );
    render(<PlanScreen />);
    expect(await screen.findByRole('button', { name: /no gold figures at all/i })).toBeDefined();
  });

  it('opens an explanation on click, and closes it on Escape', async () => {
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
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
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
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
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ dungeons: [{ ...dungeon, goldUnknown: true }] }),
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

describe('PlanScreen leftover attempts', () => {
  it('shows what the plan does not use, out of what is left this week', async () => {
    // 18 remaining, and the plan can only spend 3 of them - one character with
    // a per-character cap of 3 - so 15 go unused.
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(screen.getByText('15 / 18')).toBeDefined();
  });

  it('explains a leftover that is not zero', async () => {
    render(<PlanScreen />);
    const dot = await screen.findByRole('button', { name: /cannot be used|left unused/i });
    fireEvent.click(dot);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('says nothing when nothing is left over', async () => {
    // Exactly as many attempts remaining as the plan can spend.
    vi.mocked(loadPlanState).mockResolvedValue(
      aState({ accountAttemptsLeft: { d1: 3 } }));
    render(<PlanScreen />);
    await screen.findAllByText('Mage');
    expect(screen.getByText('0 / 3')).toBeDefined();
    expect(screen.queryByRole('button', { name: /left unused|cannot be used/i })).toBe(null);
  });
});
