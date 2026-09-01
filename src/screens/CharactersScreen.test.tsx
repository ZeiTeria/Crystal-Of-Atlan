// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CharactersScreen from './CharactersScreen';
import {
  createCharacter,
  currentGameAccountId,
  deleteCharacter,
  listCharacters,
  renameCharacter,
} from '../data/accounts';

vi.mock('../data/accounts', () => ({
  currentGameAccountId: vi.fn(),
  listCharacters: vi.fn(),
  createCharacter: vi.fn(),
  renameCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
}));

// This vitest config does not set `test.globals: true`, so @testing-library/react's
// own auto-cleanup (which checks the *global* `afterEach`) never registers - each
// `render()` call leaves its container in the document. Nor does it set
// `test.clearMocks`, so a vi.fn() created by a `vi.mock` factory keeps its call
// history across tests in the same file.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mage = {
  id: 'c1',
  game_account_id: 'acc',
  name: 'Mage',
  class: null,
  sort_order: 0,
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
  vi.mocked(currentGameAccountId).mockResolvedValue('acc');
  vi.mocked(listCharacters).mockResolvedValue([mage]);
  vi.mocked(createCharacter).mockResolvedValue({ ...mage, id: 'c2', name: 'Rogue' });
  vi.mocked(renameCharacter).mockResolvedValue(undefined);
  vi.mocked(deleteCharacter).mockResolvedValue(undefined);
});

describe('CharactersScreen', () => {
  it('lists the characters on the account', async () => {
    render(<CharactersScreen />);
    expect(await screen.findByDisplayValue('Mage')).toBeDefined();
  });

  it('adds a character to the current account', async () => {
    render(<CharactersScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.change(screen.getByLabelText('New character name'), {
      target: { value: 'Rogue' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(vi.mocked(createCharacter)).toHaveBeenCalledWith('acc', 'Rogue');
    });
  });

  it('trims whitespace and refuses an empty name', async () => {
    render(<CharactersScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.change(screen.getByLabelText('New character name'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    expect(vi.mocked(createCharacter)).not.toHaveBeenCalled();
  });

  it('disables Add while the trimmed draft is empty', async () => {
    render(<CharactersScreen />);
    await screen.findByDisplayValue('Mage');
    const addButton = screen.getByRole('button', { name: /add character/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: '   ' } });
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    expect(addButton.disabled).toBe(false);
  });

  it('disables Add immediately and creates only once when clicked twice before the create settles', async () => {
    const gate = deferred<typeof mage>();
    vi.mocked(createCharacter).mockReturnValue(gate.promise);
    render(<CharactersScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.change(screen.getByLabelText('New character name'), {
      target: { value: 'Rogue' },
    });
    const addButton = screen.getByRole('button', { name: /add character/i }) as HTMLButtonElement;

    fireEvent.click(addButton);
    expect(addButton.disabled).toBe(true);
    fireEvent.click(addButton); // a disabled button must not fire a second createCharacter

    gate.resolve({ ...mage, id: 'c2', name: 'Rogue' });
    await waitFor(() => {
      expect(vi.mocked(createCharacter)).toHaveBeenCalledTimes(1);
    });
  });

  it('renames on blur', async () => {
    render(<CharactersScreen />);
    const field = await screen.findByDisplayValue('Mage');
    fireEvent.change(field, { target: { value: 'Archmage' } });
    fireEvent.blur(field);
    await waitFor(() => {
      expect(vi.mocked(renameCharacter)).toHaveBeenCalledWith('c1', 'Archmage');
    });
  });

  it('warns that deleting a character takes its runs with it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CharactersScreen />);
    await screen.findByDisplayValue('Mage');
    fireEvent.click(screen.getByRole('button', { name: /delete mage/i }));
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/runs/i);
    await waitFor(() => {
      expect(vi.mocked(deleteCharacter)).toHaveBeenCalledWith('c1');
    });
    confirmSpy.mockRestore();
  });
});
