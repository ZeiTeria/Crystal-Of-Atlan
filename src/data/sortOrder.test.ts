import { describe, expect, it } from 'vitest';
import { nextSortOrder } from './sortOrder';

describe('nextSortOrder', () => {
  it('starts at 10 for an empty list', () => {
    expect(nextSortOrder([])).toBe(10);
  });

  it('lands 10 past the highest, not 10 past the last', () => {
    // Ordering is by sort_order, but the array may arrive in any order and a
    // descending view (Grid, Plan) hands them over reversed.
    expect(nextSortOrder([{ sort_order: 30 }, { sort_order: 10 }, { sort_order: 20 }])).toBe(40);
  });

  it('keeps the 10-step spacing the reorder relies on', () => {
    expect(nextSortOrder([{ sort_order: 10 }])).toBe(20);
  });

  it('recovers from the rows this bug already created, which all sit at 0', () => {
    expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 0 }])).toBe(10);
  });

  it('ignores a negative slot rather than counting down from it', () => {
    expect(nextSortOrder([{ sort_order: -5 }])).toBe(10);
  });
});
