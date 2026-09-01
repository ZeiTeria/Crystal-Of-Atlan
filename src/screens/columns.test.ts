import { describe, expect, it } from 'vitest';
import { groupSpans, matrixColumns } from './columns';

const d = (id: string, sort_order: number, group_name: string | null = null) => ({
  id,
  sort_order,
  group_name,
});

describe('matrixColumns', () => {
  it('puts the newest dungeon leftmost', () => {
    const cols = matrixColumns([d('a', 10), d('c', 30), d('b', 20)]);
    expect(cols.map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the list it was given', () => {
    const input = [d('a', 10), d('b', 20)];
    matrixColumns(input);
    expect(input.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('is stable for rows sharing a slot', () => {
    const cols = matrixColumns([d('a', 10), d('b', 10), d('c', 10)]);
    expect(cols.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('groupSpans', () => {
  it('merges neighbours in the same family into one span', () => {
    expect(
      groupSpans([d('a', 0, 'HexChess'), d('b', 0, 'HexChess'), d('c', 0, 'Lost Ruins')]),
    ).toEqual([
      { label: 'HexChess', span: 2 },
      { label: 'Lost Ruins', span: 1 },
    ]);
  });

  it('gives ungrouped dungeons a null-labelled span so the header still lines up', () => {
    expect(groupSpans([d('a', 0, 'HexChess'), d('b', 0, null), d('c', 0, 'HexChess')])).toEqual([
      { label: 'HexChess', span: 1 },
      { label: null, span: 1 },
      { label: 'HexChess', span: 1 },
    ]);
  });

  it('never merges two runs of a family that are not adjacent', () => {
    // Column order is the user's, not the family's: a band must never span a
    // dungeon that is not in it, or the header lies about which column is what.
    const spans = groupSpans([d('a', 0, 'HexChess'), d('b', 0, null), d('c', 0, 'HexChess')]);
    expect(spans.reduce((n, s) => n + s.span, 0)).toBe(3);
  });

  it('does not merge two ungrouped neighbours into one wide blank', () => {
    // Each unfamilied dungeon keeps its own cell, so the band stays aligned
    // with the column headers below it.
    expect(groupSpans([d('a', 0, null), d('b', 0, null)])).toEqual([
      { label: null, span: 1 },
      { label: null, span: 1 },
    ]);
  });

  it('returns nothing for an empty catalogue', () => {
    expect(groupSpans([])).toEqual([]);
  });
});
