import { describe, expect, it } from 'vitest';
import { CHARACTER_CLASSES, CLASS_FAMILIES, findClass } from './classes';

describe('character classes', () => {
  it('carries every class the official site listed when this was taken', () => {
    // 26 as of the Sugariff patch. This CANNOT tell you the game has added a
    // class - nothing here reads the site at runtime, so the list goes stale
    // silently. It guards the edit instead: change the array without meaning
    // to, or add a class and forget the family shape below, and this fails.
    expect(CHARACTER_CLASSES).toHaveLength(26);
  });

  it('gives every class a name, a colour and a mark', () => {
    for (const c of CHARACTER_CLASSES) {
      expect(c.name).toMatch(/^[A-Z][A-Za-z ]+$/);
      expect(c.hue).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.icon).toBeTruthy();
    }
  });

  it('has no duplicate names', () => {
    const names = CHARACTER_CLASSES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('finds a class whatever the casing', () => {
    expect(findClass('warlock')?.name).toBe('Warlock');
    expect(findClass('  BOUNTY HUNTER ')?.name).toBe('Bounty Hunter');
  });

  it('still finds a character saved under the old name for Puppeteer', () => {
    // Characters were created before the list came from the official site, so
    // dropping the alias would silently recolour them.
    expect(findClass('Puppet Master')?.name).toBe('Puppeteer');
  });

  it('does not invent a class for an unknown or missing name', () => {
    expect(findClass('Alchemist')).toBeUndefined();
    expect(findClass(null)).toBeUndefined();
    expect(findClass('')).toBeUndefined();
  });
});

describe('class families', () => {
  it('places every class in exactly one family', () => {
    // Seven bases plus everything they advance into, with nothing orphaned and
    // nothing counted twice.
    const placed = CLASS_FAMILIES.flatMap((f) => [f.base, ...f.advanced]);
    expect(placed).toHaveLength(CHARACTER_CLASSES.length);
    expect(new Set(placed.map((c) => c.name)).size).toBe(CHARACTER_CLASSES.length);
  });

  it('names a base class every advanced class actually advances from', () => {
    const bases = new Set(CLASS_FAMILIES.map((f) => f.base.name));
    for (const c of CHARACTER_CLASSES) {
      if (c.base === null) expect(bases.has(c.name)).toBe(true);
      else expect(bases.has(c.base)).toBe(true);
    }
  });

  it('leads with Swordsman, as the game does', () => {
    expect(CLASS_FAMILIES[0]?.base.name).toBe('Swordsman');
  });

  it('groups them the way the game does', () => {
    // From the player, not from the official site - its carousel is one flat
    // run of 26 and says nothing about which advances from which.
    const shape = Object.fromEntries(
      CLASS_FAMILIES.map((f) => [f.base.name, f.advanced.map((c) => c.name)]),
    );
    expect(shape).toEqual({
      Musketeer: ['Mystrix', 'Gunner', 'Bounty Hunter'],
      Magister: ['Magician', 'Elementalist', 'Warlock'],
      Puppeteer: ['Glaciette', 'Scytheguard', 'Blademaiden'],
      Fighter: ['Sugariff', 'Cloudstrider', 'Starbreaker'],
      Assassin: ['Specter', 'Mirage'],
      Inventor: ['Empirica', 'Rhapsodia'],
      Swordsman: ['Karmaslayer', 'Berserker', 'Magiblade'],
    });
  });

  it('has no base class that is itself an advancement', () => {
    for (const f of CLASS_FAMILIES) expect(f.base.base).toBeNull();
  });
});
