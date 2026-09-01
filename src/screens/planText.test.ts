import { describe, expect, it } from 'vitest';
import { describeConflict, describeReason, type Names } from './planText';

const names: Names = {
  character: (id) => (id === 'c1' ? 'Mage' : id),
  dungeon: (id) => (id === 'd1' ? 'Abyss' : id),
};

describe('describeReason', () => {
  it('names the dungeon that ran out of account attempts', () => {
    expect(describeReason({ kind: 'account-attempts-exhausted', dungeonId: 'd1' }, names)).toBe(
      'Abyss has no account attempts left this week.',
    );
  });

  it('names the character that hit the gold cap', () => {
    expect(describeReason({ kind: 'gold-cap-reached', characterId: 'c1' }, names)).toBe(
      'Mage has reached its weekly gold cap.',
    );
  });

  it('explains unusable attempts as an unlock problem', () => {
    expect(describeReason({ kind: 'attempts-unusable', dungeonId: 'd1', unusable: 6 }, names)).toBe(
      '6 attempts on Abyss cannot be used — not enough characters have it unlocked.',
    );
  });
});

describe('describeConflict', () => {
  it('reports a minimum on a locked dungeon', () => {
    expect(
      describeConflict({ kind: 'minimum-on-locked-dungeon', characterId: 'c1', dungeonId: 'd1' }, names),
    ).toBe('Mage has a minimum on Abyss but has not unlocked it.');
  });

  it('reports a minimum above the character cap with both numbers', () => {
    expect(
      describeConflict(
        {
          kind: 'minimum-exceeds-character-cap',
          characterId: 'c1',
          dungeonId: 'd1',
          required: 5,
          available: 3,
        },
        names,
      ),
    ).toBe('Mage needs 5 runs of Abyss but only has 3 attempts left.');
  });

  it('reports minimums above the account cap', () => {
    expect(
      describeConflict({ kind: 'minimums-exceed-account-cap', dungeonId: 'd1', required: 21, available: 18 }, names),
    ).toBe('Abyss: your minimums require 21 runs but only 18 attempts exist.');
  });

  it('reports minimums above the gold cap', () => {
    expect(
      describeConflict(
        { kind: 'minimums-exceed-gold-cap', characterId: 'c1', requiredGold: 1200000, headroom: 1000000 },
        names,
      ),
    ).toBe("Mage's minimums would earn 1,200,000 gold but only 1,000,000 fits under the cap.");
  });

  it('reports the catch-all', () => {
    expect(describeConflict({ kind: 'no-feasible-plan' }, names)).toBe(
      'No plan satisfies every requirement.',
    );
  });
});
