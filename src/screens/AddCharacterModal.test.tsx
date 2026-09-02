// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddCharacterModal from './AddCharacterModal';
import type { Dungeon, GridEntry, Tier } from '../engine/types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const abyss: Dungeon = {
  id: 'd1',
  name: 'Abyss',
  accountAttempts: 18,
  characterAttempts: 3,
  resetWeekday: 1,
  questCoverage: false,
  gold: { solo: 1, story: 2, elite: 3, legend: 4 },
  default_tier: 'elite',
  default_min_runs: 1,
  sort_order: 10,
  group_name: null,
  short_name: null,
  goldEstimated: [],
  goldUnknown: false,
};

const onAdd = vi.fn<(name: string, cls: string | null, tiers: Record<string, Tier>) => Promise<void>>();
const onClose = vi.fn();

function renderModal(opts: { grid?: GridEntry[]; characters?: { id: string; name: string }[] } = {}) {
  return render(
    <AddCharacterModal
      dungeons={[abyss]}
      grid={opts.grid ?? []}
      characters={opts.characters ?? []}
      onClose={onClose}
      onAdd={onAdd}
    />,
  );
}

/** A promise the test controls the settlement of, to catch a mid-flight state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  onAdd.mockResolvedValue(undefined);
});

describe('AddCharacterModal', () => {
  it('adds the trimmed name', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: '  Rogue ' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[0]).toBe('Rogue');
    });
  });

  it('disables Add while the trimmed draft is empty', () => {
    renderModal();
    const add = screen.getByRole('button', { name: /add character/i }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: '   ' } });
    expect(add.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    expect(add.disabled).toBe(false);
  });

  it('disables Add immediately and adds only once when clicked twice before it settles', async () => {
    const gate = deferred<void>();
    onAdd.mockReturnValue(gate.promise);
    renderModal();
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    const add = screen.getByRole('button', { name: /add character/i }) as HTMLButtonElement;

    fireEvent.click(add);
    expect(add.disabled).toBe(true);
    fireEvent.click(add); // a disabled button must not fire a second add

    gate.resolve();
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
  });

  it('adds no class unless one is chosen', async () => {
    // It used to default to the first class on the list, so a character added
    // without touching the picker was silently saved as a Sugariff.
    renderModal();
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[1]).toBe(null);
    });
  });

  it('adds the class that was chosen', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Warlock' }));
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[1]).toBe('Warlock');
    });
  });

  it('clears the class by picking it again', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Warlock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Warlock' }));
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[1]).toBe(null);
    });
  });

  it('closes without adding on Cancel', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('AddCharacterModal templates', () => {
  const withTwo = {
    characters: [
      { id: 'c1', name: 'Mage' },
      { id: 'c2', name: 'Rogue' },
    ],
  };

  it('offers every existing character as a template', () => {
    renderModal(withTwo);
    const select = screen.getByLabelText('Template') as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).toContain('char:c1');
    expect(values).toContain('char:c2');
    expect(values).toContain('tier:legend');
    expect(values).toContain('blank');
  });

  it('starts every dungeon on its own default', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[2]).toEqual({ d1: 'elite' });
    });
  });

  it('sets every dungeon to the chosen tier', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'tier:legend' } });
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[2]).toEqual({ d1: 'legend' });
    });
  });

  it('copies an existing character', async () => {
    renderModal({
      ...withTwo,
      grid: [{ characterId: 'c1', dungeonId: 'd1', tier: 'story', minRuns: 3 }],
    });
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'char:c1' } });
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[2]).toEqual({ d1: 'story' });
    });
  });

  it('copies what the source displays, defaults included', async () => {
    // The source has no stored row for this dungeon, so it displays the
    // dungeon's default. Copying only its stored rows would leave the two
    // matching by coincidence and diverging the moment that default changed.
    renderModal({ ...withTwo, grid: [] });
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'char:c1' } });
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[2]).toEqual({ d1: 'elite' });
    });
  });

  it('takes a per-dungeon choice over the template', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'tier:legend' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abyss at none' }));
    fireEvent.change(screen.getByLabelText('New character name'), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: /add character/i }));
    await waitFor(() => {
      expect(onAdd.mock.calls[0]?.[2]).toEqual({ d1: 'none' });
    });
  });
});
