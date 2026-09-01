/**
 * A short label for a dungeon, for the simplified matrix where a full name
 * cannot fit a column.
 *
 * Suggested, never imposed: the catalogue carries a `short_name` the user
 * writes, and this only fills the box when it is empty. The suggestion takes
 * the family's initials and the dungeon's, so HexChess + Checkmate reads "HC"
 * - which is how a player would abbreviate it out loud, and the reason the
 * family is included at all rather than just the name.
 */
export function suggestAbbreviation(name: string, groupName: string | null): string {
  const initials = (text: string) =>
    text
      .split(/[\s\-–—:]+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');

  const family = groupName ? initials(groupName).slice(0, 1) : '';
  const own = initials(name);

  // A dungeon with no family leans on its own name for the whole label, since
  // there is nothing to disambiguate it from.
  const suggestion = family + own;
  return suggestion.slice(0, 4);
}
