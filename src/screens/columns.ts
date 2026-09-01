/**
 * Dungeon columns for the Grid and Plan matrices, newest first.
 *
 * Deliberately the OPPOSITE of the Dungeons tab, which lists ascending so a new
 * dungeon appends to the bottom. Here the newest is the leftmost column, so it
 * is visible without scrolling right. The leftmost column is therefore the
 * bottom row of the Dungeons tab; both screens say so in their copy.
 */
export function matrixColumns<T extends { id: string; sort_order: number }>(dungeons: T[]): T[] {
  // Copied before sorting: the caller's array is React state.
  return [...dungeons].sort((a, b) => b.sort_order - a.sort_order);
}

/**
 * Runs of adjacent columns sharing a family, as `colSpan` values for the band
 * above the column headers. Only ADJACENT columns merge - a band that spanned a
 * column outside its family would label that column wrongly, and column order
 * belongs to the user, not to the families.
 */
export function groupSpans(
  dungeons: { group_name: string | null }[],
): { label: string | null; span: number }[] {
  const spans: { label: string | null; span: number }[] = [];
  for (const dungeon of dungeons) {
    const last = spans[spans.length - 1];
    if (last && last.label !== null && last.label === dungeon.group_name) last.span += 1;
    else spans.push({ label: dungeon.group_name, span: 1 });
  }
  return spans;
}
