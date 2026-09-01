import { describe, expect, it } from 'vitest';
import { suggestAbbreviation } from './abbreviate';

describe('suggestAbbreviation', () => {
  it('takes the family initial and the dungeon initials', () => {
    expect(suggestAbbreviation('Checkmate', 'HexChess')).toBe('HC');
    expect(suggestAbbreviation('Queen Coronation', 'HexChess')).toBe('HQC');
  });

  it('uses the name alone when the dungeon has no family', () => {
    expect(suggestAbbreviation('Duskfeather Lair', null)).toBe('DL');
  });

  it('splits on dashes and colons as well as spaces', () => {
    expect(suggestAbbreviation('Temple - Of Fate', null)).toBe('TOF');
    expect(suggestAbbreviation('Lost Ruins: Apocalypse', null)).toBe('LRA');
  });

  it('ignores punctuation inside a word', () => {
    expect(suggestAbbreviation("Kraken's Spine", 'Krakya Island')).toBe('KKS');
  });

  it('caps the length, so a long name cannot defeat the point of a short label', () => {
    expect(suggestAbbreviation('One Two Three Four Five Six', null)).toBe('OTTF');
  });

  it('returns an empty string for an empty name rather than throwing', () => {
    expect(suggestAbbreviation('', null)).toBe('');
    expect(suggestAbbreviation('   ', null)).toBe('');
  });
});
