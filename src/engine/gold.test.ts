import { describe, expect, it } from 'vitest';
import { fillGoldGaps } from './gold';
import type { PaidTier } from './types';

const g = (solo: number, story: number, elite: number, legend: number): Record<PaidTier, number> => ({
  solo,
  story,
  elite,
  legend,
});

describe('fillGoldGaps', () => {
  it('leaves a fully filled dungeon alone', () => {
    const gold = g(10, 20, 30, 40);
    const out = fillGoldGaps(gold);
    expect(out.gold).toBe(gold);
    expect(out.estimated).toEqual([]);
  });

  it('leaves a dungeon with no figures at all alone rather than inventing one', () => {
    const gold = g(0, 0, 0, 0);
    const out = fillGoldGaps(gold);
    expect(out.gold).toBe(gold);
    expect(out.estimated).toEqual([]);
  });

  it('spreads a single known figure to every other tier', () => {
    const out = fillGoldGaps(g(0, 0, 45000, 0));
    expect(out.gold).toEqual(g(45000, 45000, 45000, 45000));
    expect(out.estimated).toEqual(['solo', 'story', 'legend']);
  });

  it('borrows from the nearest tier, not the largest', () => {
    // story is adjacent to solo; legend is three away and pays far more.
    const out = fillGoldGaps(g(0, 100, 0, 900));
    expect(out.gold.solo).toBe(100);
    expect(out.estimated).toContain('solo');
  });

  it('breaks an equal-distance tie toward the higher figure', () => {
    // elite is empty with story and legend equally adjacent. Over-estimating
    // makes the planner stop early against the gold cap; under-estimating
    // produces a plan that blows through it.
    const out = fillGoldGaps(g(0, 100, 0, 900));
    expect(out.gold.elite).toBe(900);
  });

  it('reports exactly the tiers it guessed at', () => {
    const out = fillGoldGaps(g(10, 0, 30, 0));
    expect(out.estimated).toEqual(['story', 'legend']);
  });

  it('does not mutate the figures it was given', () => {
    const gold = g(0, 0, 30, 0);
    fillGoldGaps(gold);
    expect(gold).toEqual(g(0, 0, 30, 0));
  });

  it('never leaves a borrowed tier at zero', () => {
    for (const known of ['solo', 'story', 'elite', 'legend'] as PaidTier[]) {
      const gold = g(0, 0, 0, 0);
      gold[known] = 500;
      const out = fillGoldGaps(gold);
      for (const tier of ['solo', 'story', 'elite', 'legend'] as PaidTier[]) {
        expect(out.gold[tier]).toBe(500);
      }
    }
  });
});

describe('fillGoldGaps unknown flag', () => {
  it('is true only when no tier has a figure', () => {
    expect(fillGoldGaps(g(0, 0, 0, 0)).unknown).toBe(true);
    expect(fillGoldGaps(g(0, 0, 30, 0)).unknown).toBe(false);
    expect(fillGoldGaps(g(10, 20, 30, 40)).unknown).toBe(false);
  });

  it('reports nothing as estimated when everything is unknown', () => {
    // Nothing was borrowed, because there was nothing to borrow from. The
    // zeros are absent data, not approximations, and the two must not be
    // conflated - one warrants "this is a guess", the other "there is no data".
    expect(fillGoldGaps(g(0, 0, 0, 0)).estimated).toEqual([]);
  });
});
