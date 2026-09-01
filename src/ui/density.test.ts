// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { resetDensity, useDensity } from './density';

afterEach(() => {
  localStorage.clear();
  resetDensity();
});

describe('density', () => {
  it('starts simplified, because full names do not fit nine columns', () => {
    const { result } = renderHook(() => useDensity());
    expect(result.current[0]).toBe('simple');
  });

  it('keeps two separate screens in step', () => {
    // The Grid and the Plan both read this store; flipping it on one and
    // finding the other unchanged would read as a bug.
    const a = renderHook(() => useDensity());
    const b = renderHook(() => useDensity());

    act(() => a.result.current[1]('detailed'));

    expect(a.result.current[0]).toBe('detailed');
    expect(b.result.current[0]).toBe('detailed');
  });

  it('remembers the choice', () => {
    const { result } = renderHook(() => useDensity());
    act(() => result.current[1]('detailed'));
    expect(localStorage.getItem('atlan.density')).toBe('detailed');
  });

  it('treats anything unrecognised in storage as simplified', () => {
    localStorage.setItem('atlan.density', 'enormous');
    resetDensity();
    const { result } = renderHook(() => useDensity());
    expect(result.current[0]).toBe('simple');
  });
});
