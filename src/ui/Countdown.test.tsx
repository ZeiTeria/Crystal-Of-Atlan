// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Countdown from './Countdown';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const SETTINGS = {
  goldCap: 1_000_000,
  goldResetWeekday: 1,
  resetHour: 6,
  timeZone: 'Asia/Singapore',
};

describe('Countdown', () => {
  it('counts down to the coming reset, not the one after it', async () => {
    // An hour before the Monday 06:00 Asia/Singapore reset - the window where
    // deriving the boundary by looking a week-and-a-bit ahead read 7 days late.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-06T21:00:00Z'));
    render(<Countdown settings={SETTINGS} />);
    // The parts are separate text nodes, so match on the element's own text.
    // Under the old derivation this same instant read "7d ...".
    await vi.waitFor(() =>
      expect(
        screen.getAllByText((_, el) => /^0d 0h 59m \d\ds$/.test(el?.textContent ?? '')),
      ).not.toHaveLength(0),
    );
  });

  it('never reads zero, because the boundary is always ahead of now', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Exactly on a reset: the next one is a week away, not this instant.
    vi.setSystemTime(new Date('2026-09-06T22:00:00Z'));
    const { container } = render(<Countdown settings={SETTINGS} />);
    // The element itself, not a matcher - textContent matches every ancestor.
    expect(container.querySelector('.countdown')?.textContent).not.toMatch(/^0d 0h 00m 00s$/);
  });
});
