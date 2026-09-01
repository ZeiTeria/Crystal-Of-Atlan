/**
 * Move one item to a new index, returning a new array.
 *
 * Used by both drag and the keyboard path, so the two can never disagree about
 * what "move down one" means.
 */
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  const clamped = Math.max(0, Math.min(items.length - 1, to));
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(clamped, 0, moved as T);
  return next;
}

/**
 * The sort_order each row should take after a reorder: 10, 20, 30 …
 *
 * The whole list is rewritten rather than only the moved pair, because a swap
 * of two neighbours' values leaves the rest of the list unevenly spaced and the
 * gaps eventually close. Ten apart matches nextSortOrder, so a row created
 * afterwards still lands past the end.
 */
export function sortOrderPatches(ids: string[]): { id: string; sort_order: number }[] {
  return ids.map((id, i) => ({ id, sort_order: (i + 1) * 10 }));
}
