/**
 * The slot a newly created row should take: ten past the highest in use, so it
 * lands at the END of an ascending list.
 *
 * Ten rather than one because reordering rewrites the whole list as
 * (index + 1) * 10, and matching that spacing keeps the two consistent.
 *
 * Floors at 10, which is what recovers the rows this bug already created: they
 * all sit at the schema default of 0, so counting from them would keep
 * producing 10 and colliding. A collision is survivable - the list simply falls
 * back to its secondary order - but a negative or zero slot would sort a new
 * row above everything, which is the bug itself.
 */
export function nextSortOrder(rows: { sort_order: number }[]): number {
  const highest = rows.reduce((max, row) => Math.max(max, row.sort_order), 0);
  return Math.max(10, highest + 10);
}
