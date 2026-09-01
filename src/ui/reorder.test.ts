import { describe, expect, it } from 'vitest';
import { reorder, sortOrderPatches } from './reorder';

describe('reorder', () => {
  it('moves an item down', () => {
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('moves an item up', () => {
    expect(reorder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns the same array when nothing moves, so React can skip the render', () => {
    const items = ['a', 'b', 'c'];
    expect(reorder(items, 1, 1)).toBe(items);
  });

  it('clamps a target past the end rather than dropping the item', () => {
    expect(reorder(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
  });

  it('clamps a negative target rather than wrapping to the end', () => {
    expect(reorder(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b']);
  });

  it('ignores a source index that is not in the list', () => {
    const items = ['a', 'b'];
    expect(reorder(items, 7, 0)).toBe(items);
  });

  it('never loses or duplicates an item', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    for (let from = 0; from < items.length; from++) {
      for (let to = 0; to < items.length; to++) {
        expect([...reorder(items, from, to)].sort()).toEqual([...items].sort());
      }
    }
  });

  it('does not mutate its input', () => {
    const items = ['a', 'b', 'c'];
    reorder(items, 0, 2);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('sortOrderPatches', () => {
  it('rewrites the whole list 10 apart', () => {
    expect(sortOrderPatches(['a', 'b', 'c'])).toEqual([
      { id: 'a', sort_order: 10 },
      { id: 'b', sort_order: 20 },
      { id: 'c', sort_order: 30 },
    ]);
  });

  it('starts at 10, never 0, so a row can never sort above the list', () => {
    expect(sortOrderPatches(['only'])[0]?.sort_order).toBe(10);
  });

  it('handles an empty list', () => {
    expect(sortOrderPatches([])).toEqual([]);
  });
});
