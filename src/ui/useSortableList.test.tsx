// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSortableList } from './useSortableList';

afterEach(cleanup);

/**
 * jsdom has no layout and no elementFromPoint, so the POINTER path cannot be
 * exercised here - it is verified by hand on a real device. The keyboard path
 * is the whole automated coverage, and it is the more important one: the user
 * chose drag-only over keeping the up/down buttons, so this is the only way to
 * reorder without a pointer.
 */
function List({ onReorder }: { onReorder: (ids: string[]) => void }) {
  const { order, handleProps } = useSortableList({ ids: ['a', 'b', 'c'], onReorder });
  return (
    <ul>
      {order.map((id) => (
        <li key={id} data-sortable-id={id}>
          <span {...handleProps(id, `Reorder ${id}`)} />
          {id}
        </li>
      ))}
    </ul>
  );
}

const orderOnScreen = () =>
  screen.getAllByRole('listitem').map((li) => li.getAttribute('data-sortable-id'));

describe('useSortableList keyboard', () => {
  it('moves an item down and commits on the second Space', () => {
    const onReorder = vi.fn();
    render(<List onReorder={onReorder} />);
    const grip = screen.getByRole('button', { name: /reorder a/i });

    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    expect(orderOnScreen()).toEqual(['b', 'a', 'c']);
    expect(onReorder).not.toHaveBeenCalled();

    fireEvent.keyDown(grip, { key: ' ' });
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('restores the original order on Escape and writes nothing', () => {
    const onReorder = vi.fn();
    render(<List onReorder={onReorder} />);
    const grip = screen.getByRole('button', { name: /reorder a/i });

    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    fireEvent.keyDown(grip, { key: 'Escape' });

    expect(orderOnScreen()).toEqual(['a', 'b', 'c']);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('ignores arrows until the item is lifted', () => {
    const onReorder = vi.fn();
    render(<List onReorder={onReorder} />);
    const grip = screen.getByRole('button', { name: /reorder a/i });

    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    expect(orderOnScreen()).toEqual(['a', 'b', 'c']);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not write when the item is dropped where it started', () => {
    const onReorder = vi.fn();
    render(<List onReorder={onReorder} />);
    const grip = screen.getByRole('button', { name: /reorder a/i });

    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    fireEvent.keyDown(grip, { key: 'ArrowUp' });
    fireEvent.keyDown(grip, { key: ' ' });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('will not move the first item above the top', () => {
    const onReorder = vi.fn();
    render(<List onReorder={onReorder} />);
    const grip = screen.getByRole('button', { name: /reorder a/i });

    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowUp' });
    expect(orderOnScreen()).toEqual(['a', 'b', 'c']);
  });

  it('says the item is lifted, so a screen reader knows arrows now move it', () => {
    render(<List onReorder={vi.fn()} />);
    const grip = screen.getByRole('button', { name: /reorder a/i });
    fireEvent.keyDown(grip, { key: ' ' });
    expect(screen.getByRole('button', { name: /lifted, arrows to move/i })).toBeDefined();
  });

  it('is reachable by tab', () => {
    render(<List onReorder={vi.fn()} />);
    expect(screen.getByRole('button', { name: /reorder a/i }).getAttribute('tabindex')).toBe('0');
  });
});
