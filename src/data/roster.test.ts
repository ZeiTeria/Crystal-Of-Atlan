import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_CHARACTERS, maxCharacters, nextDefaultName } from './roster';

describe('the character cap', () => {
  it('takes the setting when there is one', () => {
    expect(maxCharacters({ max_characters: 20 })).toBe(20);
  });

  it('falls back to the current answer, not to no limit', () => {
    // The column is absent until migration 0010 has run. Treating that as
    // "unlimited" would let a roster past a cap the game itself enforces.
    expect(maxCharacters({})).toBe(DEFAULT_MAX_CHARACTERS);
    expect(maxCharacters(null)).toBe(DEFAULT_MAX_CHARACTERS);
    expect(maxCharacters(undefined)).toBe(DEFAULT_MAX_CHARACTERS);
  });

  it('is twelve today', () => {
    expect(DEFAULT_MAX_CHARACTERS).toBe(12);
  });
});

describe('default character names', () => {
  it('starts at Char1 on an empty roster', () => {
    expect(nextDefaultName([])).toBe('Char1');
  });

  it('counts past the ones already taken', () => {
    expect(nextDefaultName([{ name: 'Char1' }, { name: 'Char2' }])).toBe('Char3');
  });

  it('fills a gap rather than running past it', () => {
    // Delete Char2 out of three and "one more than the count" would hand out
    // Char3, which is still on the roster.
    expect(nextDefaultName([{ name: 'Char1' }, { name: 'Char3' }])).toBe('Char2');
  });

  it('ignores names that are not defaults at all', () => {
    expect(nextDefaultName([{ name: 'ZTeria' }, { name: 'Zephyr' }])).toBe('Char1');
  });

  it('treats a differently-cased or padded name as taken', () => {
    // "char1" and "Char1" are the same name to anyone reading the roster.
    expect(nextDefaultName([{ name: 'char1' }, { name: '  CHAR2 ' }])).toBe('Char3');
  });
});
