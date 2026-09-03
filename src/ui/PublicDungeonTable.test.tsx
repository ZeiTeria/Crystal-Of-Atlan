// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Dungeon } from '../engine/types';
import PublicDungeonTable from './PublicDungeonTable';

afterEach(() => {
  cleanup();
});

function aDungeon(overrides: Partial<Dungeon> = {}): Dungeon {
  return {
    id: 'd1',
    name: 'Test Dungeon',
    group_name: null,
    short_name: 'TD',
    accountAttempts: 3,
    characterAttempts: 3,
    resetWeekday: 1,
    manual: false,
    default_tier: 'none',
    default_min_runs: 0,
    sort_order: 10,
    gold: { solo: 1000, story: 2000, elite: 3000, legend: 4000 },
    goldEstimated: [],
    goldUnknown: false,
    ...overrides,
  };
}

describe('PublicDungeonTable', () => {
  it('shows the blended figure for every tier', () => {
    // These are the effective figures the solver used, stone premium already
    // folded in - not the raw base the admin typed.
    render(<PublicDungeonTable dungeons={[aDungeon()]} />);

    expect(screen.getByText('Test Dungeon')).toBeDefined();
    expect(screen.getByText('1,000')).toBeDefined();
    expect(screen.getByText('2,000')).toBeDefined();
    expect(screen.getByText('3,000')).toBeDefined();
    expect(screen.getByText('4,000')).toBeDefined();
  });

  it('marks the tiers whose figure was borrowed from another tier', () => {
    // fillGoldGaps borrows a missing base from the nearest tier that has one.
    // A reader has to be able to tell those apart from a measured figure.
    render(<PublicDungeonTable dungeons={[aDungeon({ goldEstimated: ['story', 'legend'] })]} />);

    expect(screen.getAllByText('*')).toHaveLength(2);
  });

  it('shows a dash rather than a figure when the dungeon has no gold at all', () => {
    // goldUnknown means nothing was borrowed because there was nothing to
    // borrow. Printing the zeros would read as "this dungeon pays nothing".
    render(<PublicDungeonTable dungeons={[aDungeon({ goldUnknown: true })]} />);

    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('1,000')).toBeNull();
  });
});
