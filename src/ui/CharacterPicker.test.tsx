// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharacterPicker from './CharacterPicker';

afterEach(() => {
  cleanup();
});

const characters = [
  { id: 'c1', name: 'Mage' },
  { id: 'c2', name: 'Rogue' },
];

describe('CharacterPicker', () => {
  it('no add button renders when onAdd is omitted', () => {
    render(<CharacterPicker characters={characters} selectedId="c1" onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Add character' })).toBeNull();
  });

  it('the add button renders and calls onAdd when it is provided', () => {
    const onAdd = vi.fn();
    render(<CharacterPicker characters={characters} selectedId="c1" onSelect={() => {}} onAdd={onAdd} />);
    const addButton = screen.getByRole('button', { name: 'Add character' });
    expect(addButton).not.toBeNull();
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('the add button is not part of the tablist (getAllByRole("tab") length is unchanged)', () => {
    const { unmount } = render(<CharacterPicker characters={characters} selectedId="c1" onSelect={() => {}} />);
    const tabsWithoutAdd = screen.getAllByRole('tab').length;
    unmount();

    render(<CharacterPicker characters={characters} selectedId="c1" onSelect={() => {}} onAdd={() => {}} />);
    const tabsWithAdd = screen.getAllByRole('tab').length;

    expect(tabsWithAdd).toBe(tabsWithoutAdd);

    // Explicitly verify the length matches the number of characters
    expect(tabsWithAdd).toBe(2);
  });
});
