// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DungeonsScreen from './DungeonsScreen';
import { createDungeon, deleteDungeon, listDungeons, updateDungeon } from '../data/dungeons';

vi.mock('../data/dungeons', () => ({
  listDungeons: vi.fn(),
  createDungeon: vi.fn(),
  updateDungeon: vi.fn(),
  deleteDungeon: vi.fn(),
}));

// This vitest config does not set `test.globals: true`, so @testing-library/react's
// own auto-cleanup (which checks the *global* `afterEach`) never registers - each
// `render()` call leaves its container in the document. Every test here renders the
// same "Abyss" row and the same "New dungeon name" field, so leftover containers
// produce false "multiple elements" failures without an explicit cleanup.
afterEach(() => {
  cleanup();
});

const abyss = {
  id: 'd1',
  name: 'Abyss',
  account_attempts: 18,
  character_attempts: 3,
  reset_weekday: 1,
  quest_coverage: true,
  gold_solo: 100,
  gold_story: 200,
  gold_elite: 300,
  gold_legend: 400,
  sort_order: 0,
  is_active: true,
  default_tier: 'elite' as const,
  default_min_runs: 1,
};

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
  // This vitest config does not set `test.clearMocks`, so a vi.fn() created by a
  // `vi.mock` factory keeps its call history across tests in the same file. Clear
  // it before each test, or a later "not called" assertion inherits an earlier
  // test's call.
  vi.clearAllMocks();
  vi.mocked(listDungeons).mockResolvedValue([abyss]);
  vi.mocked(createDungeon).mockResolvedValue({ ...abyss, id: 'd2', name: 'Vault' });
  vi.mocked(updateDungeon).mockResolvedValue(undefined);
  vi.mocked(deleteDungeon).mockResolvedValue(undefined);
});

describe('DungeonsScreen', () => {
  it('lists the catalogue', async () => {
    render(<DungeonsScreen />);
    expect(await screen.findByDisplayValue('Abyss')).toBeDefined();
  });

  it('creates a dungeon from the new-dungeon form', async () => {
    render(<DungeonsScreen />);
    await screen.findByDisplayValue('Abyss');
    fireEvent.change(screen.getByLabelText('New dungeon name'), {
      target: { value: 'Vault' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add dungeon/i }));
    await waitFor(() => {
      expect(vi.mocked(createDungeon)).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Vault' }),
      );
    });
  });

  it('refuses to create a dungeon with a blank name', async () => {
    render(<DungeonsScreen />);
    await screen.findByDisplayValue('Abyss');
    fireEvent.click(screen.getByRole('button', { name: /add dungeon/i }));
    expect(vi.mocked(createDungeon)).not.toHaveBeenCalled();
  });

  it('disables Add while the trimmed name is empty', async () => {
    render(<DungeonsScreen />);
    await screen.findByDisplayValue('Abyss');
    const addButton = screen.getByRole('button', { name: /add dungeon/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New dungeon name'), { target: { value: '   ' } });
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New dungeon name'), { target: { value: 'Vault' } });
    expect(addButton.disabled).toBe(false);
  });

  it('disables Add immediately and creates only once when clicked twice before the create settles', async () => {
    const gate = deferred<typeof abyss>();
    vi.mocked(createDungeon).mockReturnValue(gate.promise);
    render(<DungeonsScreen />);
    await screen.findByDisplayValue('Abyss');
    fireEvent.change(screen.getByLabelText('New dungeon name'), {
      target: { value: 'Vault' },
    });
    const addButton = screen.getByRole('button', { name: /add dungeon/i }) as HTMLButtonElement;

    fireEvent.click(addButton);
    expect(addButton.disabled).toBe(true);
    fireEvent.click(addButton); // a disabled button must not fire a second createDungeon

    gate.resolve({ ...abyss, id: 'd2', name: 'Vault' });
    await waitFor(() => {
      expect(vi.mocked(createDungeon)).toHaveBeenCalledTimes(1);
    });
  });

  it('saves an edited gold value as a number, not a string', async () => {
    render(<DungeonsScreen />);
    const legend = await screen.findByLabelText('Abyss legend gold');
    fireEvent.change(legend, { target: { value: '999' } });
    fireEvent.blur(legend);
    await waitFor(() => {
      expect(vi.mocked(updateDungeon)).toHaveBeenCalledWith('d1', { gold_legend: 999 });
    });
  });

  it('warns that deleting a dungeon takes every logged run of it with it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DungeonsScreen />);
    await screen.findByDisplayValue('Abyss');
    fireEvent.click(screen.getByRole('button', { name: /delete abyss/i }));
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/logged run/i);
    expect(vi.mocked(deleteDungeon)).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
